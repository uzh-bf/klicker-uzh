import {
  ElementBlockStatus,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { getCorrelatedLiveQuizResponseExport } from '../src/services/liveQuizzes.js'

function createContext({
  liveQuiz = {
    displayName: 'Correlated Quiz',
    exportSalt: 'quiz-salt',
    isAssessmentEnabled: false,
    name: 'correlated-quiz',
    responseCollectionMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
    status: PublicationStatus.ENDED,
    blocks: [
      {
        execution: 0,
        order: 0,
        status: ElementBlockStatus.EXECUTED,
        elements: [{ id: 10, order: 0 }],
      },
    ],
  },
  responses = [
    {
      basePoints: 10,
      bonusPoints: 2,
      correctness: ResponseCorrectness.CORRECT,
      correctnessPoints: 5,
      elementBlockExecution: 0,
      instanceId: 10,
      participantId: 'participant-id',
      respondentId: null,
      response: { value: 'answer' },
    },
    {
      basePoints: 10,
      bonusPoints: 0,
      correctness: ResponseCorrectness.WRONG,
      correctnessPoints: 0,
      elementBlockExecution: 0,
      instanceId: 10,
      participantId: null,
      respondentId: 'respondent-id',
      response: { value: 'another answer' },
    },
  ],
}: {
  liveQuiz?: any
  responses?: any[]
} = {}) {
  const findMany = vi.fn().mockResolvedValue(responses)
  return {
    findMany,
    ctx: {
      user: { sub: 'lecturer-id' },
      prisma: {
        liveQuiz: { findUnique: vi.fn().mockResolvedValue(liveQuiz) },
        liveQuizResponse: { findMany },
      },
    } as unknown as ContextWithUser,
  }
}

describe('getCorrelatedLiveQuizResponseExport', () => {
  it('returns a respondent-row CSV without source identities', async () => {
    const { ctx } = createContext()

    const result = await getCorrelatedLiveQuizResponseExport(
      { id: 'quiz-id' },
      ctx
    )

    expect(result.filename).toBe('live-quiz-correlated-quiz-responses.csv')
    expect(result.respondentCount).toBe(2)
    expect(result.content).toContain(
      'block_01_question_01_execution_01_response'
    )
    expect(result.content).not.toContain('participant-id')
    expect(result.content).not.toContain('respondent-id')
    expect(result.content.match(/^respondent_\d{3},/gm)).toHaveLength(2)
  })

  it.each([
    {
      name: 'quiz is still running',
      overrides: { status: PublicationStatus.PUBLISHED },
      error: 'LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY',
    },
    {
      name: 'quiz uses aggregate collection',
      overrides: {
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      },
      error: 'LIVE_QUIZ_CORRELATED_EXPORT_UNAVAILABLE',
    },
    {
      name: 'quiz is an assessment',
      overrides: { isAssessmentEnabled: true },
      error: 'LIVE_QUIZ_CORRELATED_EXPORT_UNAVAILABLE',
    },
  ])('rejects the export when $name', async ({ overrides, error }) => {
    const base = createContext()
    const liveQuiz = await (base.ctx.prisma.liveQuiz.findUnique as any)()
    const { ctx, findMany } = createContext({
      liveQuiz: { ...liveQuiz, ...overrides },
    })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow(error)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('returns a clear error when no responses were persisted', async () => {
    const { ctx } = createContext({ responses: [] })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow('LIVE_QUIZ_CORRELATED_EXPORT_EMPTY')
  })
})
