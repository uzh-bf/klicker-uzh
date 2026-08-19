import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { computeFreeTextRetryAnalytics } from '../src/services/practiceQuizzes.js'

describe('practice quiz free-text retry analytics', () => {
  it('aggregates first and best outcomes without exposing attempt details', () => {
    const result = computeFreeTextRetryAnalytics([
      {
        solutionRevealedAt: null,
        attempts: [
          {
            ordinal: 1,
            evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
            correctness: DB.FreeTextCorrectnessCategory.INCORRECT,
          },
          {
            ordinal: 2,
            evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
            correctness: DB.FreeTextCorrectnessCategory.CORRECT,
          },
        ],
      },
      {
        solutionRevealedAt: new Date('2026-08-19T08:00:00.000Z'),
        attempts: [
          {
            ordinal: 1,
            evaluationStatus: DB.FreeTextEvaluationStatus.UNAVAILABLE,
            correctness: null,
          },
          {
            ordinal: 2,
            evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
            correctness: DB.FreeTextCorrectnessCategory.PARTIAL,
          },
        ],
      },
    ])

    expect(result).toEqual({
      cycleCount: 2,
      totalAttempts: 4,
      averageAttempts: 2,
      successRate: 0.5,
      revealRate: 0.5,
      unavailableCount: 1,
      first: { correct: 0, partial: 1, incorrect: 1 },
      best: { correct: 1, partial: 1, incorrect: 0 },
    })
    expect(result).not.toHaveProperty('attempts')
    expect(result).not.toHaveProperty('participants')
  })

  it('returns stable zero values when no participant has started a cycle', () => {
    expect(computeFreeTextRetryAnalytics([])).toEqual({
      cycleCount: 0,
      totalAttempts: 0,
      averageAttempts: 0,
      successRate: 0,
      revealRate: 0,
      unavailableCount: 0,
      first: { correct: 0, partial: 0, incorrect: 0 },
      best: { correct: 0, partial: 0, incorrect: 0 },
    })
  })
})
