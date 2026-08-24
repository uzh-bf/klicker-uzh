import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const makeClient = () => {
    const queue: unknown[] = []
    const chainable: any = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === 'exec') {
            return (...args: unknown[]) => {
              const execFn =
                (chainable as any).__execImpl ?? (() => Promise.resolve([]))
              return execFn(...args)
            }
          }
          return (...args: unknown[]) => {
            queue.push({ cmd: prop, args })
            return chainable
          }
        },
      }
    )
    ;(chainable as any).__queue = queue
    return chainable
  }

  const regularClient = {
    hgetall: vi.fn(),
    hexists: vi.fn(),
    sismember: vi.fn(),
    eval: vi.fn(),
    multi: vi.fn(),
  }

  return { makeClient, regularClient }
})

vi.mock('../redis.js', () => ({
  getRedis: () => hoisted.regularClient,
}))

import { processResponseMessage } from '../processors/processor.js'
import type { Context, DurableContext } from '@hatchet-dev/typescript-sdk/index.js'

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
  const transaction = hoisted.makeClient()
  transaction.__execImpl = () =>
    Promise.resolve(
      Array.from({ length: (transaction.__queue as unknown[]).length }, () => [
        null,
        1,
      ])
    )
  client.multi.mockReturnValue(transaction)
  return transaction
}

describe('processResponseMessage atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates inside a MULTI transaction with the processed marker as final command', async () => {
    const transaction = setupHappyPath(hoisted.regularClient)

    const result = await processResponseMessage(createMessage(), createContext())

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
    hoisted.regularClient.multi.mockImplementation(() => {
      const transaction = hoisted.makeClient()
      transaction.__execImpl = () =>
        Promise.resolve([
          [null, 1],
          [new Error('WRONGTYPE Operation against a key'), null],
        ])
      return transaction
    })
    const ctx = createContext()

    const result = await processResponseMessage(createMessage(), ctx)

    expect(result).toEqual({ status: 200 })
    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('accepting partial application')
    )
  })

  it('throws on connection-level MULTI failures so safe retries can happen', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.regularClient.multi.mockImplementation(() => {
      const transaction = hoisted.makeClient()
      transaction.__execImpl = () => Promise.reject(new Error('connection down'))
      return transaction
    })

    await expect(
      processResponseMessage(createMessage(), createContext())
    ).rejects.toThrow('Redis transaction failed')
  })
})
