import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { Redis } from 'ioredis'
import {
  ATOMIC_RESPONSE_SCRIPT,
  buildResponseScriptInvocation,
  createRedisOperationCollector,
  getAnonymousResponseField,
  getParticipantResponseField,
  getRedeliveryResponseField,
  isValidSubmissionId,
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

  it('derives a stable redelivery field from the message id', () => {
    const field = getRedeliveryResponseField('message-1')
    assert.match(field, /^redelivery-[0-9a-f]{64}$/)
    assert.equal(field, getRedeliveryResponseField('message-1'))
    assert.notEqual(field, getRedeliveryResponseField('message-2'))
    assert.notEqual(field, getAnonymousResponseField('message-1'))
  })

  it('validates bounded opaque submission ids', () => {
    assert.ok(isValidSubmissionId('client-1:lq-uuid-ex-0-i-13'))
    assert.ok(!isValidSubmissionId(''))
    assert.ok(!isValidSubmissionId('has space'))
    assert.ok(!isValidSubmissionId('a'.repeat(257)))
    assert.ok(!isValidSubmissionId(42 as unknown as string))
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
      /Missing participant response marker operation/
    )
  })

  it('throws when conflicting marker writes are collected', () => {
    assert.throws(
      () =>
        buildResponseScriptInvocation({
          operations: [
            ...responseMarker(),
            ...responseMarker({ value: 'other' }),
          ],
          participantResponseKey: RESPONSE_KEY,
          participantResponseField: 'p-1',
        }),
      /Conflicting participant response marker operations/
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

  it('throws when cumulative increments for one target exceed the safe integer bound', () => {
    const half = Number.MAX_SAFE_INTEGER / 2 + 2
    assert.throws(
      () =>
        buildResponseScriptInvocation({
          operations: [
            ...responseMarker(),
            {
              type: 'hincrby',
              key: RESULTS_KEY,
              field: 'participants',
              increment: half,
            },
            {
              type: 'hincrby',
              key: RESULTS_KEY,
              field: 'participants',
              increment: half,
            },
          ],
          participantResponseKey: RESPONSE_KEY,
          participantResponseField: 'p-1',
        }),
      /Cumulative Redis increment .* exceeds the safe integer bound/
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
  const createdPrefixes: string[] = []

  async function runScript(keys: string[], args: string[]): Promise<number> {
    return Number(
      await redis.eval(ATOMIC_RESPONSE_SCRIPT, keys.length, ...keys, ...args)
    )
  }

  before(async () => {
    try {
      await redis.connect()
      await redis.ping()
      available = true
    } catch {
      available = false
      if (process.env.RESPONSE_SCRIPT_TESTS_REQUIRE_REDIS === '1') {
        throw new Error(
          'Redis integration tests are required (RESPONSE_SCRIPT_TESTS_REQUIRE_REDIS=1) but no Redis is reachable'
        )
      }
    }
  })

  after(async () => {
    if (available) {
      for (const prefix of createdPrefixes) {
        const keys = await redis.keys(`test:response-script:${prefix}:*`)
        if (keys.length > 0) await redis.del(...keys)
      }
    }
    redis.disconnect()
  })

  function setupKeys() {
    const prefix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    createdPrefixes.push(prefix)
    return {
      responseKey: `test:response-script:${prefix}:responses`,
      resultsKey: `test:response-script:${prefix}:results`,
      hashesKey: `test:response-script:${prefix}:responseHashes`,
      infoKey: `test:response-script:${prefix}:info`,
      lbKey: `test:response-script:${prefix}:lb`,
    }
  }

  function markerOp(responseKey: string, field: string): RedisHashOperation[] {
    return [
      { type: 'hset', key: responseKey, field, value: 'answer', mode: 'set' },
    ]
  }

  it('applies a first response exactly once', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey, lbKey } = setupKeys()

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
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

  it('applies competing identical submissions exactly once', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
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

    const results = await Promise.all(
      Array.from({ length: 10 }, () => runScript(keys, args))
    )
    assert.equal(
      results.filter((result) => result === 1).length,
      1,
      'exactly one competing submission applies'
    )
    assert.equal(results.filter((result) => result === 0).length, 9)
    assert.equal(await redis.hget(resultsKey, 'participants'), '1')
    assert.equal(await redis.hget(responseKey, 'p-1'), 'answer')
  })

  it('applies nothing when an existing counter is not an integer', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.hset(resultsKey, 'participants', 'not-a-number')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
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

  it('refuses counter values that would overflow the safe integer bound', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.hset(resultsKey, 'participants', '9007199254740990')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
        {
          type: 'hincrby',
          key: resultsKey,
          field: 'participants',
          increment: 5,
        },
      ],
      participantResponseKey: responseKey,
      participantResponseField: 'p-1',
    })

    assert.equal(await runScript(keys, args), -1)
    assert.equal(
      await redis.hget(responseKey, 'p-1'),
      null,
      'the marker must not be written when the bound is exceeded'
    )
    assert.equal(
      await redis.hget(resultsKey, 'participants'),
      '9007199254740990',
      'the existing counter must be unchanged'
    )
  })

  it('refuses repeated increments whose cumulative total overflows, even when each is small', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.hset(resultsKey, 'participants', '9007199254740990')

    // hand-crafted args: two increments of 5 to the same field whose
    // combined effect with the stored value exceeds the safe bound
    const keys = [responseKey, resultsKey]
    const args = [
      'p-1',
      'answer',
      '2',
      '2',
      'participants',
      '5',
      '2',
      'participants',
      '5',
      '0',
    ]

    assert.equal(await runScript(keys, args), -1)
    assert.equal(await redis.hget(responseKey, 'p-1'), null)
    assert.equal(
      await redis.hget(resultsKey, 'participants'),
      '9007199254740990'
    )
  })

  it('refuses noncanonical stored counter strings before any write', async (t) => {
    if (!available) return t.skip('Redis not reachable')

    for (const corruptValue of ['01', '00', '-0', '1.0', '+1']) {
      const { responseKey, resultsKey } = setupKeys()
      await redis.hset(resultsKey, 'participants', corruptValue)

      const { keys, args } = buildResponseScriptInvocation({
        operations: [
          ...markerOp(responseKey, 'p-1'),
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

      assert.equal(
        await runScript(keys, args),
        -1,
        `stored value ${corruptValue} must be refused`
      )
      assert.equal(
        await redis.hget(responseKey, 'p-1'),
        null,
        'the marker must not be written for a noncanonical counter'
      )
      assert.equal(
        await redis.hget(resultsKey, 'participants'),
        corruptValue,
        'the stored value must be unchanged'
      )
    }
  })

  it('accepts boundary counters up to the shared safe bound', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.hset(resultsKey, 'participants', '9007199254740990')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
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

    assert.equal(await runScript(keys, args), 1)
    assert.equal(
      await redis.hget(resultsKey, 'participants'),
      '9007199254740991'
    )
  })

  it('refuses the increment one past the shared safe bound', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.hset(resultsKey, 'participants', '9007199254740991')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
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
    assert.equal(await redis.hget(responseKey, 'p-1'), null)
    assert.equal(
      await redis.hget(resultsKey, 'participants'),
      '9007199254740991'
    )
  })

  it('refuses wrong-type increment targets before any write', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.set(resultsKey, 'a-string-key')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
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

    assert.equal(await runScript(keys, args), -2)
    assert.equal(await redis.hget(responseKey, 'p-1'), null)
  })

  it('refuses wrong-type late hset targets before the marker is written', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey, hashesKey } = setupKeys()
    await redis.set(hashesKey, 'a-string-key')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
        {
          type: 'hincrby',
          key: resultsKey,
          field: 'participants',
          increment: 1,
        },
        {
          type: 'hset',
          key: hashesKey,
          field: 'hash-1',
          value: 'answer text',
          mode: 'set',
        },
      ],
      participantResponseKey: responseKey,
      participantResponseField: 'p-1',
    })

    assert.equal(await runScript(keys, args), -2)
    assert.equal(
      await redis.hget(responseKey, 'p-1'),
      null,
      'the marker must not be written when a later target has the wrong type'
    )
    assert.equal(
      await redis.hget(resultsKey, 'participants'),
      null,
      'counters must remain unchanged'
    )
  })

  it('refuses a wrong-type response key itself', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, resultsKey } = setupKeys()
    await redis.set(responseKey, 'a-string-key')

    const { keys, args } = buildResponseScriptInvocation({
      operations: [
        ...markerOp(responseKey, 'p-1'),
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

    assert.equal(await runScript(keys, args), -2)
  })

  it('does not overwrite setnx fields on a later distinct response', async (t) => {
    if (!available) return t.skip('Redis not reachable')
    const { responseKey, infoKey } = setupKeys()

    for (const participant of ['p-1', 'p-2']) {
      const { keys, args } = buildResponseScriptInvocation({
        operations: [
          ...markerOp(responseKey, participant),
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
