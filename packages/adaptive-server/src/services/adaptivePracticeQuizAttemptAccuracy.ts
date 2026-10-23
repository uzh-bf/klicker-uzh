import type { AdaptiveDiagnosticSummary } from './adaptivePracticeQuizAttemptDiagnosticsModel.js'

/**
 * Accuracy of the adaptive results against the lecturer's reviews
 * (testing environments only). Only reviewed attempts count. Level
 * differences are estimated minus expected level, in levels of the quiz
 * scale, for the overall level and for every competence with an expected
 * level.
 */
export type AdaptiveAttemptReviewAccuracy = {
  reviewedAttempts: number
  asExpected: number
  tooHigh: number
  tooLow: number
  unsure: number
  /** Comparisons of an estimated with an expected level (overall + competences). */
  levelComparisons: number
  /** Share of comparisons where the estimate equals the expected level. */
  exactShare: number | null
  /** Share within one level of the expected level. */
  withinOneLevelShare: number | null
  /** Mean signed difference (estimated - expected); positive = too high. */
  meanLevelDifference: number | null
  meanAbsoluteLevelDifference: number | null
}

export function summarizeAdaptiveReviewAccuracy(
  attempts: readonly AdaptiveDiagnosticSummary[],
  levelLabels: readonly string[]
): AdaptiveAttemptReviewAccuracy {
  const index = new Map(levelLabels.map((label, position) => [label, position]))
  const reviewed = attempts.filter(({ review }) => review !== null)
  const differences: number[] = []
  const compare = (estimated: string | null, expected: string | null) => {
    if (!estimated || !expected) return
    const a = index.get(estimated)
    const b = index.get(expected)
    if (a !== undefined && b !== undefined) differences.push(a - b)
  }
  for (const attempt of reviewed) {
    const review = attempt.review!
    compare(attempt.overall.levelLabel, review.expectedOverallLevelLabel)
    for (const expected of review.expectedCompetenceLevels) {
      const competence = attempt.competences.find(
        ({ nodeId }) => nodeId === expected.nodeId
      )
      compare(competence?.levelLabel ?? null, expected.levelLabel)
    }
  }
  const count = (verdict: string) =>
    reviewed.filter(({ review }) => review!.verdict === verdict).length
  const share = (predicate: (difference: number) => boolean) =>
    differences.length === 0
      ? null
      : differences.filter(predicate).length / differences.length
  const mean = (values: number[]) =>
    values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    reviewedAttempts: reviewed.length,
    asExpected: count('AS_EXPECTED'),
    tooHigh: count('TOO_HIGH'),
    tooLow: count('TOO_LOW'),
    unsure: count('UNSURE'),
    levelComparisons: differences.length,
    exactShare: share((difference) => difference === 0),
    withinOneLevelShare: share((difference) => Math.abs(difference) <= 1),
    meanLevelDifference: mean(differences),
    meanAbsoluteLevelDifference: mean(differences.map(Math.abs)),
  }
}
