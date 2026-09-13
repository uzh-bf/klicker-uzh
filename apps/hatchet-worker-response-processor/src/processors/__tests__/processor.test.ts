import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const regularClient = {
    hgetall: vi.fn(),
    hexists: vi.fn(),
    zscore: vi.fn(),
    eval: vi.fn(),
  }

  const verifyJWT = vi.fn()

  return { regularClient, verifyJWT }
})

vi.mock('../../redis.js', () => ({
  getRedis: () => hoisted.regularClient,
}))

vi.mock('@klicker-uzh/util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@klicker-uzh/util')>()),
  verifyJWT: hoisted.verifyJWT,
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
    solutions: JSON.stringify([0]),
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
    hoisted.verifyJWT.mockResolvedValue({
      sub: 'participant-1',
      role: 'PARTICIPANT',
    })
    hoisted.regularClient.hexists.mockResolvedValue(false)

    const result = await processResponseMessage(
      { ...createMessage(), cookie: 'participant_token=test-token' },
      createContext()
    )

    expect(result).toEqual({ status: 200 })
    expect(hoisted.regularClient.eval).toHaveBeenCalledWith(
      LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
      6,
      'lq:quiz-1:i:inst-1:responses:processed:claims',
      'lq:quiz-1:i:inst-1:responses:processed:count',
      'lq:quiz-1:i:inst-1:info',
      'lq:quiz-1:i:inst-1:responses:processed',
      'lq:quiz-1:i:inst-1:responses:reconciliation',
      'lq:quiz-1:i:inst-1:responses:received',
      'msg-1',
      '86400',
      expect.any(String),
      '2048'
    )
    const commandList = JSON.parse(
      hoisted.regularClient.eval.mock.calls[0]![10] as string
    ) as string[][]
    expect(commandList.some(([command]) => command === 'HINCRBY')).toBe(true)
    expect(commandList).toContainEqual([
      'HSETNX',
      'lq:quiz-1:i:inst-1:info',
      'firstResponseReceivedAt',
      expect.any(Number),
    ])
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

  it('rejects malformed choice indices before building a Redis batch', async () => {
    setupHappyPath(hoisted.regularClient)
    const message = createMessage()
    message.response.choices = [
      { ix: 0, selected: true },
      { ix: 2, selected: false },
    ]

    const result = await processResponseMessage(message, createContext())

    expect(result).toEqual({ status: 400 })
    expect(hoisted.regularClient.eval).not.toHaveBeenCalled()
  })

  it('does not hide reconciliation behind the authenticated duplicate guard', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.verifyJWT.mockResolvedValue({
      sub: 'participant-1',
      role: 'PARTICIPANT',
    })
    hoisted.regularClient.hexists.mockResolvedValue(true)
    hoisted.regularClient.zscore.mockResolvedValue(
      String(-Math.floor(Date.now() / 1000))
    )
    hoisted.regularClient.eval.mockResolvedValue(
      JSON.stringify({
        status: 'reconciliation_required',
        commandErrors: ['partial aggregation requires reconciliation'],
        trackingErrors: [],
      })
    )
    const message = {
      ...createMessage(),
      cookie: 'participant_token=test-token',
    }

    await expect(
      processResponseMessage(message, createContext())
    ).rejects.toThrow('Redis transaction failed')
    expect(hoisted.regularClient.eval).toHaveBeenCalledTimes(1)
    const commands = JSON.parse(
      hoisted.regularClient.eval.mock.calls[0]![10] as string
    ) as string[][]
    expect(commands.map((command) => command[1])).toEqual(
      expect.arrayContaining([
        'lq:quiz-1:i:inst-1:results',
        'lq:quiz-1:b:1:lb',
        'lq:quiz-1:lb',
        'lq:quiz-1:xp',
      ])
    )
  })

  it('throws when the authenticated replay lookup fails so Hatchet retries', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.verifyJWT.mockResolvedValue({
      sub: 'participant-1',
      role: 'PARTICIPANT',
    })
    hoisted.regularClient.hexists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    hoisted.regularClient.zscore.mockRejectedValue(
      new Error('redis connection lost')
    )
    const message = {
      ...createMessage(),
      cookie: 'participant_token=test-token',
    }

    await expect(
      processResponseMessage(message, createContext())
    ).rejects.toThrow('redis connection lost')
    expect(hoisted.regularClient.eval).not.toHaveBeenCalled()
  })

  it('keeps reconciliation results failed and visible to Hatchet', async () => {
    setupHappyPath(hoisted.regularClient)
    hoisted.regularClient.eval.mockResolvedValue(
      JSON.stringify({
        status: 'reconciliation_required',
        commandErrors: ['increment overflow'],
        trackingErrors: [],
      })
    )
    const ctx = createContext()

    await expect(processResponseMessage(createMessage(), ctx)).rejects.toThrow(
      'Redis transaction failed'
    )
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
