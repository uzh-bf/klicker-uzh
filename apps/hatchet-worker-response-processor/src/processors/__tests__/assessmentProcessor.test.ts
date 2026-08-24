import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  assessmentClient: {
    eval: vi.fn(),
  },
}))

vi.mock('../../redis.js', () => ({
  getAssessmentRedis: () => hoisted.assessmentClient,
}))

import type {
  Context,
  DurableContext,
} from '@hatchet-dev/typescript-sdk/index.js'
import { ElementType } from '@klicker-uzh/prisma/client'
import { LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT } from '@klicker-uzh/util'
import { aggregateAssessmentResponses } from '../assessmentProcessor.js'

function createContext() {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    cancel: vi.fn(),
  } as unknown as Context<Record<string, never>, {}> &
    DurableContext<Record<string, never>, {}>
}

function createMessage() {
  return {
    correlationId: 'correlation-1',
    participantId: 'participant-1',
    liveQuizId: 'quiz-1',
    blockId: '1',
    instanceId: 'instance-1',
    elementType: ElementType.CONTENT,
    isGamificationEnabled: false,
    pointsAwarded: 0,
    xpAwarded: 0,
    response: { viewed: true },
  }
}

function setupHappyPath() {
  hoisted.assessmentClient.eval.mockResolvedValue(
    JSON.stringify({
      status: 'processed',
      commandErrors: [],
      trackingErrors: [],
    })
  )
}

describe('aggregateAssessmentResponses atomic processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the assessment Redis client and atomic processing script', async () => {
    setupHappyPath()

    const result = await aggregateAssessmentResponses(
      createMessage(),
      createContext()
    )

    expect(result).toEqual({ status: 200 })
    expect(hoisted.assessmentClient.eval).toHaveBeenCalledWith(
      LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
      3,
      'lq:quiz-1:i:instance-1:responses:processed',
      'lq:quiz-1:i:instance-1:responses:processed:count',
      'lq:quiz-1:i:instance-1:info',
      'correlation-1',
      '86400',
      expect.any(String)
    )
    expect(
      JSON.parse(hoisted.assessmentClient.eval.mock.calls[0]![7] as string)
    ).toEqual([
      ['HINCRBY', 'lq:quiz-1:i:instance-1:results', 'participants', 1],
    ])
  })

  it('accepts an assessment replay result without applying aggregation twice', async () => {
    setupHappyPath()
    hoisted.assessmentClient.eval.mockResolvedValue(
      JSON.stringify({ status: 'already_processed' })
    )
    const ctx = createContext()

    const result = await aggregateAssessmentResponses(createMessage(), ctx)

    expect(result).toEqual({ status: 200 })
    expect(hoisted.assessmentClient.eval).toHaveBeenCalledTimes(1)
    expect(ctx.logger.info).toHaveBeenCalledWith(
      'Assessment response already processed, skipping',
      expect.objectContaining({ correlationId: 'correlation-1' })
    )
  })

  it('accepts per-command errors after the assessment marker is claimed', async () => {
    setupHappyPath()
    hoisted.assessmentClient.eval.mockResolvedValue(
      JSON.stringify({
        status: 'aggregation_failed',
        commandErrors: ['WRONGTYPE Operation against a key'],
        trackingErrors: [],
      })
    )
    const ctx = createContext()

    const result = await aggregateAssessmentResponses(createMessage(), ctx)

    expect(result).toEqual({ status: 200 })
    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('processed count unchanged')
    )
  })
})
