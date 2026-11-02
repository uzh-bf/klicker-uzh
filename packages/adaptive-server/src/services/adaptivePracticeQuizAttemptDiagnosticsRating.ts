import { DEFAULT_THETA_RANGE } from '@klicker-uzh/adaptive-contract'

/**
 * Quality rating of one adaptive attempt for the lecturer diagnostics
 * (testing environments only). It never changes a result; it flags attempts
 * whose result rests on weak evidence. The true level of a student is never
 * known, so the rating combines observable signals:
 *
 * - precision: how wide the overall likely range is when the level is not
 *   determined (same 20% / one third thresholds as the student certainty)
 * - person fit: the standardized log-likelihood lz of each competence's
 *   answers at its final estimate (3PL with the pool item parameters);
 *   strongly negative values mean contradictory answers
 * - targeting: the share of answers more than three levels from the final
 *   competence estimate
 * - edges: a competence estimate at the scale clamp or in levels without
 *   published items
 * - coverage: a competence with fewer answers than the reporting minimum
 *
 * The attempt rating is the worst triggered signal.
 */

export type AdaptiveAttemptRatingLevel = 'GOOD' | 'CHECK' | 'UNRELIABLE'

export type AdaptiveAttemptRatingReasonCode =
  | 'PRECISION_MEDIUM'
  | 'PRECISION_WIDE'
  | 'PERSON_FIT'
  | 'TARGETING'
  | 'EDGE_CLAMP'
  | 'EDGE_UNMEASURED'
  | 'COVERAGE_LOW'

export type AdaptiveAttemptRatingReason = {
  code: AdaptiveAttemptRatingReasonCode
  severity: Exclude<AdaptiveAttemptRatingLevel, 'GOOD'>
  /** Competence name; null for overall signals. */
  nodeName: string | null
  /** lz, a share (0-1) or an answer count, depending on the code. */
  value: number | null
}

export const ADAPTIVE_ATTEMPT_RATING_THRESHOLDS = {
  precisionCheckFraction: 0.2,
  precisionUnreliableFraction: 1 / 3,
  personFitCheck: -1.64,
  personFitUnreliable: -2.33,
  offLevelDistance: 3,
  targetingCheckShare: 0.3,
  targetingUnreliableShare: 0.5,
  minimumCompetenceAnswers: 4,
  defaultDiscrimination: 1.2,
} as const

export type AdaptiveRatingItem = {
  difficulty: number
  discrimination: number | null
  guessing: number | null
}

export type AdaptiveRatingAnswer = {
  item: AdaptiveRatingItem
  correct: boolean
  /** Item level order minus the final competence level order. */
  levelDistance: number | null
}

export type AdaptiveRatingCompetence = {
  name: string
  theta: number | null
  responseCount: number
  answers: AdaptiveRatingAnswer[]
  /** Whether the final estimate's level has published items. */
  levelHasElements: boolean
}

function probability(theta: number, item: AdaptiveRatingItem) {
  const a =
    item.discrimination ??
    ADAPTIVE_ATTEMPT_RATING_THRESHOLDS.defaultDiscrimination
  const c = item.guessing ?? 0
  const p = c + (1 - c) / (1 + Math.exp(-a * (theta - item.difficulty)))
  return Math.min(1 - 1e-9, Math.max(1e-9, p))
}

/**
 * Standardized log-likelihood person-fit statistic lz (Drasgow et al.). Null
 * when it is undefined (no variance, e.g. a single answer).
 */
export function computeAdaptivePersonFit(
  theta: number,
  answers: ReadonlyArray<Pick<AdaptiveRatingAnswer, 'item' | 'correct'>>
): number | null {
  let observed = 0
  let expected = 0
  let variance = 0
  for (const { item, correct } of answers) {
    const p = probability(theta, item)
    const q = 1 - p
    observed += correct ? Math.log(p) : Math.log(q)
    expected += p * Math.log(p) + q * Math.log(q)
    variance += p * q * Math.log(p / q) ** 2
  }
  if (!(variance > 0)) return null
  return (observed - expected) / Math.sqrt(variance)
}

export function rateAdaptiveAttempt({
  overallDetermined,
  overallRangeLevelCount,
  levelCount,
  competences,
  thetaRange = DEFAULT_THETA_RANGE,
}: {
  overallDetermined: boolean
  /** Levels the overall likely range touches; null without a range. */
  overallRangeLevelCount: number | null
  levelCount: number
  competences: AdaptiveRatingCompetence[]
  thetaRange?: { min: number; max: number }
}): {
  level: AdaptiveAttemptRatingLevel
  reasons: AdaptiveAttemptRatingReason[]
} {
  const limits = ADAPTIVE_ATTEMPT_RATING_THRESHOLDS
  const reasons: AdaptiveAttemptRatingReason[] = []

  if (!overallDetermined && levelCount > 0) {
    const fraction =
      overallRangeLevelCount === null ? 1 : overallRangeLevelCount / levelCount
    if (fraction > limits.precisionUnreliableFraction) {
      reasons.push({
        code: 'PRECISION_WIDE',
        severity: 'UNRELIABLE',
        nodeName: null,
        value: overallRangeLevelCount,
      })
    } else if (fraction > limits.precisionCheckFraction) {
      reasons.push({
        code: 'PRECISION_MEDIUM',
        severity: 'CHECK',
        nodeName: null,
        value: overallRangeLevelCount,
      })
    }
  }

  for (const competence of competences) {
    if (competence.responseCount < limits.minimumCompetenceAnswers) {
      reasons.push({
        code: 'COVERAGE_LOW',
        severity: 'CHECK',
        nodeName: competence.name,
        value: competence.responseCount,
      })
    }
    if (competence.theta === null) continue

    if (competence.answers.length >= limits.minimumCompetenceAnswers) {
      const lz = computeAdaptivePersonFit(competence.theta, competence.answers)
      if (lz !== null && lz < limits.personFitCheck) {
        reasons.push({
          code: 'PERSON_FIT',
          severity: lz < limits.personFitUnreliable ? 'UNRELIABLE' : 'CHECK',
          nodeName: competence.name,
          value: Number(lz.toFixed(2)),
        })
      }
    }

    const distances = competence.answers.flatMap(({ levelDistance }) =>
      levelDistance === null ? [] : [levelDistance]
    )
    if (distances.length > 0) {
      const share =
        distances.filter(
          (distance) => Math.abs(distance) > limits.offLevelDistance
        ).length / distances.length
      if (share > limits.targetingCheckShare) {
        reasons.push({
          code: 'TARGETING',
          severity:
            share > limits.targetingUnreliableShare ? 'UNRELIABLE' : 'CHECK',
          nodeName: competence.name,
          value: Number(share.toFixed(2)),
        })
      }
    }

    const atClamp =
      competence.theta <= thetaRange.min + 1e-6 ||
      competence.theta >= thetaRange.max - 1e-6
    if (atClamp) {
      reasons.push({
        code: 'EDGE_CLAMP',
        severity: 'CHECK',
        nodeName: competence.name,
        value: null,
      })
    } else if (!competence.levelHasElements) {
      reasons.push({
        code: 'EDGE_UNMEASURED',
        severity: 'CHECK',
        nodeName: competence.name,
        value: null,
      })
    }
  }

  const level: AdaptiveAttemptRatingLevel = reasons.some(
    ({ severity }) => severity === 'UNRELIABLE'
  )
    ? 'UNRELIABLE'
    : reasons.length > 0
      ? 'CHECK'
      : 'GOOD'
  return { level, reasons }
}
