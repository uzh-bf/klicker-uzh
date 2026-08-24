import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const TRANSACTION_COMMANDS = [
    'hincrby',
    'hset',
    'sadd',
    'srem',
    'expire',
    'del',
    'unlink',
    'zincrby',
    'zadd',
    'lpush',
    'rpush',
  ] as const

  const makeTransaction = () => {
    const queue: { cmd: string; args: unknown[] }[] = []
    const transaction: Record<string, unknown> = {}
    for (const cmd of TRANSACTION_COMMANDS) {
      transaction[cmd] = (...args: unknown[]) => {
        queue.push({ cmd, args })
        return transaction
      }
    }
    transaction.exec = () =>
      (
        (transaction.__execImpl as () => Promise<unknown[]>) ??
        (() => Promise.resolve(queue.map(() => [null, 1])))
      )()
    transaction.discard = () => transaction
    transaction.__queue = queue
    return transaction
  }

  const regularClient = {
    hgetall: vi.fn(),
    hexists: vi.fn(),
    sismember: vi.fn(),
    eval: vi.fn(),
    multi: vi.fn(),
  }

  return { makeTransaction, regularClient }
})

vi.mock('../../redis.js', () => ({
  getRedis: () => hoisted.regularClient,
}))

import type {
  Context,
  DurableContext,
} from '@hatchet-dev/typescript-sdk/index.js'
import { processResponseMessage } from '../processor.js'

function createContext() {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    cancel: vi.fn(),
  } as unknown as Context<Record<string, never>, {}> &
    DurableContext<Record<string, never>, {}>
}

function createMessage() {
  return {
    messageId: 'msg-1',
    sessionId: 'quiz-1',
    instanceId: 'inst-1',
    cookie: undefined,
    responseTimestamp: Date.now(),
    response: {
      type: 'SC' as const,
      choices: [
        { ix: 0, selected: true },
        { ix: 1, selected: false },
      ],
    },
  }
}

function setupHappyPath(client: typeof hoisted.regularClient) {
  client.hgetall.mockResolvedValue({
    type: 'SC',
    solutions: JSON.stringify([
      { ix: 0, correct: true },
      { ix: 1, correct: false },
    ]),
    sessionBlockId: '1',
    choiceCount: '2',
    basePoints: '5',
    pointsMultiplier: '1',
    firstResponseReceivedAt: '',
  })
  client.sismember.mockResolvedValue(0)
  client.eval.mockResolvedValue(86400)
  const transaction = hoisted.makeTransaction()
  client.multi.mockReturnValue(transaction)
  return transaction
}

describe('processResponseMessage atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates inside a MULTI transaction with the processed marker as final command', async () => {
    const transaction = setupHappyPath(hoisted.regularClient)

    const result = await processResponseMessage(
      createMessage(),
      createContext()
    )

    expect(result).toEqual({ status: 200 })
    expect(hoisted.regularClient.multi).toHaveBeenCalled()
    const queue = transaction.__queue as { cmd: string; args: unknown[] }[]
    expect(queue[queue.length - 1]).toEqual({
      cmd: 'sadd',
      args: ['lq:quiz-1:i:inst-1:responses:processed', 'msg-1'],
    })
    expect(queue.some((entry) => entry.cmd === 'hincrby')).toBe(true)
    expect(hoisted.regularClient.eval).toHaveBeenCalled()
  })

  it('short-circuits replays via the processed-set guard without re-executing aggregation', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.regularClient.sismember.mockResolvedValue(1)
    const ctx = createContext()

    const result = await processResponseMessage(createMessage(), ctx)

    expect(result).toEqual({ status: 200 })
    expect(hoisted.regularClient.multi).not.toHaveBeenCalled()
    expect(hoisted.regularClient.eval).not.toHaveBeenCalled()
    expect(ctx.logger.info).toHaveBeenCalledWith(
      'Response already processed, skipping',
      expect.objectContaining({ messageId: 'msg-1' })
    )
  })

  it('logs and accepts per-command MULTI errors instead of triggering a Hatchet retry', async () => {
    setupHappyPath(hoisted.regularClient)
    const ctx = createContext()
    hoisted.regularClient.multi.mockImplementation(() => {
      const transaction = hoisted.makeTransaction()
      transaction.__execImpl = () =>
        Promise.resolve([
          [null, 1],
          [new Error('WRONGTYPE Operation against a key'), null],
        ])
      return transaction
    })

    const result = await processResponseMessage(createMessage(), ctx)

    expect(result).toEqual({ status: 200 })
    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('accepting partial application')
    )
  })

  it('throws on connection-level MULTI failures so safe retries can happen', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.regularClient.multi.mockImplementation(() => {
      const transaction = hoisted.makeTransaction()
      transaction.__execImpl = () =>
        Promise.reject(new Error('connection down'))
      return transaction
    })

    await expect(
      processResponseMessage(createMessage(), createContext())
    ).rejects.toThrow('Redis transaction failed')
  })
})
