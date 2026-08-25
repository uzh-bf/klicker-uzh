import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const regularClient = {
    hgetall: vi.fn(),
    hexists: vi.fn(),
    eval: vi.fn(),
  }

  return { regularClient }
})

vi.mock('../../redis.js', () => ({
  getRedis: () => hoisted.regularClient,
}))

import type {
  Context,
  DurableContext,
} from '@hatchet-dev/typescript-sdk/index.js'
import { LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT } from '@klicker-uzh/util'
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
  client.eval.mockResolvedValue(
    JSON.stringify({
      status: 'processed',
      commandErrors: [],
      trackingErrors: [],
    })
  )
}

describe('processResponseMessage atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the atomic processing script before applying aggregation commands', async () => {
    setupHappyPath(hoisted.regularClient)

    const result = await processResponseMessage(
      createMessage(),
      createContext()
    )

    expect(result).toEqual({ status: 200 })
    expect(hoisted.regularClient.eval).toHaveBeenCalledWith(
      LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
      4,
      'lq:quiz-1:i:inst-1:responses:processed:claims',
      'lq:quiz-1:i:inst-1:responses:processed:count',
      'lq:quiz-1:i:inst-1:info',
      'lq:quiz-1:i:inst-1:responses:processed',
      'msg-1',
      '86400',
      expect.any(String)
    )
    const commandList = JSON.parse(
      hoisted.regularClient.eval.mock.calls[0]![8] as string
    ) as string[][]
    expect(commandList.some(([command]) => command === 'HINCRBY')).toBe(true)
  })

  it('accepts the atomic replay result without applying aggregation twice', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.regularClient.eval.mockResolvedValue(
      JSON.stringify({ status: 'already_processed' })
    )
    const ctx = createContext()

    const result = await processResponseMessage(createMessage(), ctx)

    expect(result).toEqual({ status: 200 })
    expect(hoisted.regularClient.eval).toHaveBeenCalledTimes(1)
    expect(ctx.logger.info).toHaveBeenCalledWith(
      'Response already processed, skipping',
      expect.objectContaining({ messageId: 'msg-1' })
    )
  })

  it('acknowledges reconciliation results without retrying partial writes', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.regularClient.eval.mockResolvedValue(
      JSON.stringify({
        status: 'reconciliation_required',
        commandErrors: ['increment overflow'],
        trackingErrors: [],
      })
    )
    const ctx = createContext()

    const result = await processResponseMessage(createMessage(), ctx)

    expect(result).toEqual({ status: 200 })
    expect(ctx.logger.error).toHaveBeenCalledWith(
      'Redis response aggregation requires reconciliation; replay claim retained',
      expect.objectContaining({
        extra: expect.objectContaining({
          messageId: 'msg-1',
          commandErrors: ['increment overflow'],
        }),
      })
    )
  })

  it('throws on per-command processing errors so Hatchet can retry', async () => {
    setupHappyPath(hoisted.regularClient)
    const ctx = createContext()
    hoisted.regularClient.eval.mockResolvedValue(
      JSON.stringify({
        status: 'aggregation_failed',
        commandErrors: ['WRONGTYPE Operation against a key'],
        trackingErrors: [],
      })
    )

    await expect(processResponseMessage(createMessage(), ctx)).rejects.toThrow(
      'Redis transaction failed'
    )
    expect(ctx.logger.error).toHaveBeenCalledWith(
      'Redis results aggregation commands failed; retrying response processing',
      expect.objectContaining({
        extra: expect.objectContaining({
          messageId: 'msg-1',
          commandErrors: ['WRONGTYPE Operation against a key'],
        }),
      })
    )
  })

  it('throws on connection-level processing failures so safe retries can happen', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.regularClient.eval.mockRejectedValue(new Error('connection down'))

    await expect(
      processResponseMessage(createMessage(), createContext())
    ).rejects.toThrow('Redis transaction failed')
  })
})
