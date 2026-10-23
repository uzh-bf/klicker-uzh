import { describe, expect, it } from 'vitest'
import {
  accumulateAdaptivePracticeQuizDiagnostics,
  createAdaptivePracticeQuizDiagnosticsAccumulator,
  finalizeAdaptiveItemDiagnostics,
  finalizeAdaptivePilotMetrics,
  summarizeAdaptiveHistogram,
} from '../src/services/adaptivePracticeQuizDiagnostics.js'

describe('adaptive box plot summaries', () => {
  it('interpolates quartiles using observation counts, not histogram buckets', () => {
    expect(
      summarizeAdaptiveHistogram(
        new Map([
          [10, 1],
          [2, 2],
          [4, 1],
        ])
      )
    ).toEqual({ min: 2, q1: 2, median: 3, q3: 5.5, max: 10, count: 4 })
  })
  it('handles empty, single and constant cohorts', () => {
    expect(summarizeAdaptiveHistogram(new Map())).toBeNull()
    expect(summarizeAdaptiveHistogram(new Map([[0, 1]]))).toEqual({
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      count: 1,
    })
    expect(summarizeAdaptiveHistogram(new Map([[5, 7]]))).toEqual({
      min: 5,
      q1: 5,
      median: 5,
      q3: 5,
      max: 5,
      count: 7,
    })
  })
  it('uses recorded durations only while retaining zero-duration results', () => {
    const accumulator = createAdaptivePracticeQuizDiagnosticsAccumulator([])
    accumulator.questionCounts = new Map([[8, 3]])
    accumulator.durations = new Map([
      [0, 1],
      [60, 1],
    ])
    const metrics = finalizeAdaptivePilotMetrics({
      practiceQuizId: 'synthetic',
      cohortSize: 3,
      accumulator,
    })
    expect(metrics.questionCountBoxPlot?.count).toBe(3)
    expect(metrics.completionTimeBoxPlot).toEqual({
      min: 0,
      q1: 15,
      median: 30,
      q3: 45,
      max: 60,
      count: 2,
    })
    accumulator.durations.clear()
    expect(
      finalizeAdaptivePilotMetrics({
        practiceQuizId: 'synthetic',
        cohortSize: 3,
        accumulator,
      }).completionTimeBoxPlot
    ).toBeNull()
  })

  it('retains factual item metrics and leaves deprecated model metrics unavailable', () => {
    const accumulator = createAdaptivePracticeQuizDiagnosticsAccumulator([
      {
        id: 1,
        elementName: 'Synthetic item',
        elementType: 'SC',
        nodeNamePath: ['Root'],
        levelLabel: 'Level 1',
      } as never,
    ])
    accumulateAdaptivePracticeQuizDiagnostics({
      accumulator,
      attempt: { elapsedSeconds: 30 },
      overall: { theta: 0, standardError: 1, responseCount: 30, levelId: 1 },
      responses: Array.from({ length: 30 }, () => ({
        poolItemId: 1,
        correct: true,
      })),
    })

    expect(finalizeAdaptiveItemDiagnostics(30, accumulator)[0]).toMatchObject({
      responseCount: 30,
      exposureRate: 1,
      observedCorrectRate: 1,
      expectedCorrectRate: null,
      residual: null,
      misfitFlag: null,
    })
    expect(
      finalizeAdaptivePilotMetrics({
        practiceQuizId: 'synthetic',
        cohortSize: 30,
        accumulator,
      }).nearBoundaryRate
    ).toBeNull()
  })
})
