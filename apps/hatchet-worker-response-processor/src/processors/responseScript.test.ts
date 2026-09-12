import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { Redis } from 'ioredis'
import {
  ADD_AUTHENTICATED_RESPONSE_SCRIPT,
  buildResponseScriptInvocation,
  createRedisOperationCollector,
  getAnonymousResponseField,
  getParticipantResponseField,
  type RedisHashOperation,
} from './responseScript.js'

const RESPONSE_KEY = 'lq:quiz-1:i:13:responses'
const RESULTS_KEY = 'lq:quiz-1:i:13:results'
const INFO_KEY = 'lq:quiz-1:i:13:info'
const LB_KEY = 'lq:quiz-1:lb'

describe('response field helpers', () => {
  it('prefixes temporary participants and uses the sub for regular participants', () => {
    assert.equal(
      getParticipantResponseField({
        sub: 'p-1',
        role: 'TEMPORARY_PARTICIPANT',
      }),
      'temporary-p-1'
    )
    assert.equal(
      getParticipantResponseField({ sub: 'p-1', role: 'PARTICIPANT' }),
      'p-1'
    )
  })

  it('hashes anonymous submission ids into a prefixed field', () => {
    const field = getAnonymousResponseField('client:quiz:instance')
    assert.match(field, /^anonymous-[0-9a-f]{64}$/)
    assert.equal(
      field,
      getAnonymousResponseField('client:quiz:instance'),
      'the same submission id must map to the same field'
    )
    assert.notEqual(
      field,
      getAnonymousResponseField('client:quiz:other-instance')
    )
  })
})

describe('redis operation collector', () => {
  it('records hincrby, hset and hsetnx operations with coerced values', () => {
    const operations: RedisHashOperation[] = []
    const collector = createRedisOperationCollector(operations)

    collector
      .hincrby(RESULTS_KEY, 'participants', 1)
      .hset(RESPONSE_KEY, 'p-1', { answered: true })
      .hsetnx(INFO_KEY, 'firstResponseReceivedAt', 1234)

    assert.deepEqual(operations, [
      {
        type: 'hincrby',
        key: RESULTS_KEY,
        field: 'participants',
        increment: 1,
      },
      {
        type: 'hset',
        key: RESPONSE_KEY,
        field: 'p-1',
        value: '[object Object]',
        mode: 'set',
      },
      {
        type: 'hset',
        key: INFO_KEY,
        field: 'firstResponseReceivedAt',
        value: '1234',
        mode: 'setnx',
      },
    ])
  })

  it('clears all recorded operations on discard', () => {
    const operations: RedisHashOperation[] = []
    const collector = createRedisOperationCollector(operations)

    collector.hincrby(RESULTS_KEY, 'participants', 1)
    collector.discard()

    assert.deepEqual(operations, [])
  })
})

describe('buildResponseScriptInvocation', () => {
  const responseMarker = (
    overrides: Partial<Extract<RedisHashOperation, { type: 'hset' }>> = {}
  ): RedisHashOperation[] => [
    {
      type: 'hset',
      key: RESPONSE_KEY,
      field: 'p-1',
      value: '[{"ix":0,"selected":true}]',
      mode: 'set',
      ...overrides,
    },
  ]

  it('encodes increments and hsets with 1-based key indexes and excludes the marker from the hset list', () => {
    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...responseMarker(),
        {
          type: 'hincrby',
          key: RESULTS_KEY,
          field: 'participants',
          increment: 1,
        },
        { type: 'hincrby', key: RESULTS_KEY, field: '0', increment: 1 },
        { type: 'hincrby', key: LB_KEY, field: 'p-1', increment: 50 },
        {
          type: 'hset',
          key: INFO_KEY,
          field: 'firstResponseReceivedAt',
          value: '1234',
          mode: 'setnx',
        },
      ],
      participantResponseKey: RESPONSE_KEY,
      participantResponseField: 'p-1',
    })

    // the response key is always KEYS[1], remaining keys follow first-seen
    // order and are deduplicated
    assert.deepEqual(keys, [RESPONSE_KEY, RESULTS_KEY, LB_KEY, INFO_KEY])

    // ARGV: field, marker value, increment count, 3 slots per increment,
    // hset count, 4 slots per hset
    assert.deepEqual(args, [
      'p-1',
      '[{"ix":0,"selected":true}]',
      '3',
      '2',
      'participants',
      '1',
      '2',
      '0',
      '1',
      '3',
      'p-1',
      '50',
      '1',
      '4',
      'firstResponseReceivedAt',
      '1234',
      'setnx',
    ])
  })

  it('keeps additional hsets on the response key in the hset list', () => {
    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...responseMarker(),
        {
          type: 'hset',
          key: RESPONSE_KEY,
          field: 'p-1:meta',
          value: 'x',
          mode: 'set',
        },
      ],
      participantResponseKey: RESPONSE_KEY,
      participantResponseField: 'p-1',
    })

    assert.deepEqual(keys, [RESPONSE_KEY])
    // after field, marker value and increment count of 0: one hset with 4
    // slots, where the response key itself is KEYS[1]
    assert.deepEqual(args.slice(3), ['1', '1', 'p-1:meta', 'x', 'set'])
  })

  it('throws when no operation writes the response marker', () => {
    assert.throws(
      () =>
        buildResponseScriptInvocation({
          operations: [
            {
              type: 'hincrby',
              key: RESULTS_KEY,
              field: 'participants',
              increment: 1,
            },
          ],
          participantResponseKey: RESPONSE_KEY,
          participantResponseField: 'p-1',
        }),
      /Missing authenticated participant response marker/
    )
  })

  it('throws when an increment is not an integer', () => {
    assert.throws(
      () =>
        buildResponseScriptInvocation({
          operations: [
            ...responseMarker(),
            {
              type: 'hincrby',
              key: RESULTS_KEY,
              field: 'participants',
              increment: 1.5,
            },
          ],
          participantResponseKey: RESPONSE_KEY,
          participantResponseField: 'p-1',
        }),
      /Invalid Redis integer increment 1\.5 for .*:participants/
    )
  })
})

describe('atomic response script against redis', { concurrency: false }, () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    lazyConnect: true,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  })
  redis.on('error', () => {})

  let available = false
  let prefix = ''

  async function runScript(keys: string[], args: string[]): Promise<number> {
    return Number(
      await redis.eval(
        ADD_AUTHENTICATED_RESPONSE_SCRIPT,
        keys.length,
        ...keys,
        ...args
      )
    )
  }

  before(async () => {
    try {
      await redis.connect()
      await redis.ping()
      available = true
    } catch {
      available = false
    }
  })

  after(async () => {
    if (available && prefix) {
      const keys = await redis.keys(`test:response-script:${prefix}:*`)
      if (keys.length > 0) await redis.del(...keys)
    }
    redis.disconnect()
  })

  function setupKeys() {
    prefix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return {
      responseKey: `test:response-script:${prefix}:responses`,
      resultsKey: `test:response-script:${prefix}:results`,
      infoKey: `test:response-script:${prefix}:info`,
      lbKey: `test:response-script:${prefix}:lb`,
    }
  }

  it('applies a first response exactly once', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey, lbKey } = setupKeys()

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        {
          type: 'hset',
          key: responseKey,
          field: 'p-1',
          value: 'answer',
          mode: 'set',
        },
        {
          type: 'hincrby',
          key: resultsKey,
          field: 'participants',
          increment: 1,
        },
        { type: 'hincrby', key: resultsKey, field: '0', increment: 1 },
        { type: 'hincrby', key: lbKey, field: 'p-1', increment: 50 },
      ],
      participantResponseKey: responseKey,
      participantResponseField: 'p-1',
    })

    assert.equal(await runScript(keys, args), 1)
    assert.equal(await redis.hget(responseKey, 'p-1'), 'answer')
    assert.equal(await redis.hget(resultsKey, 'participants'), '1')
    assert.equal(await redis.hget(resultsKey, '0'), '1')
    assert.equal(await redis.hget(lbKey, 'p-1'), '50')

    // a replay of the identical aggregation must be a no-op
    assert.equal(await runScript(keys, args), 0)
    assert.equal(await redis.hget(resultsKey, 'participants'), '1')
    assert.equal(await redis.hget(resultsKey, '0'), '1')
    assert.equal(await redis.hget(lbKey, 'p-1'), '50')
  })

  it('applies nothing when an existing counter is not an integer', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.hset(resultsKey, 'participants', 'not-a-number')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        {
          type: 'hset',
          key: responseKey,
          field: 'p-1',
          value: 'answer',
          mode: 'set',
        },
        {
          type: 'hincrby',
          key: resultsKey,
          field: 'participants',
          increment: 1,
        },
      ],
      participantResponseKey: responseKey,
      participantResponseField: 'p-1',
    })

    assert.equal(await runScript(keys, args), -1)
    assert.equal(
      await redis.hget(responseKey, 'p-1'),
      null,
      'the marker must not be written when validation fails'
    )
  })

  it('refuses non-integer increments before any write', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()

    // hand-crafted args bypass the TypeScript-side integer validation to
    // prove the script itself also refuses before writing
    const keys = [responseKey, resultsKey]
    const args = ['p-1', 'answer', '1', '2', 'participants', '1.5', '0']

    assert.equal(await runScript(keys, args), -1)
    assert.equal(await redis.hget(responseKey, 'p-1'), null)
  })

  it('does not overwrite setnx fields on a later distinct response', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, infoKey } = setupKeys()

    for (const participant of ['p-1', 'p-2']) {
      const { keys, args } = buildResponseScriptInvocation({
        operations: [
          {
            type: 'hset',
            key: responseKey,
            field: participant,
            value: 'v',
            mode: 'set',
          },
          {
            type: 'hset',
            key: infoKey,
            field: 'firstResponseReceivedAt',
            value: participant === 'p-1' ? '1000' : '2000',
            mode: 'setnx',
          },
        ],
        participantResponseKey: responseKey,
        participantResponseField: participant,
      })
      assert.equal(await runScript(keys, args), 1)
    }

    assert.equal(await redis.hget(infoKey, 'firstResponseReceivedAt'), '1000')
  })
})
