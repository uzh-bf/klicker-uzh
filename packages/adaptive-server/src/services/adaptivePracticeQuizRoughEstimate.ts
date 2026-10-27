import {
  clamp,
  type LevelDefinition,
  type LevelMappingRule,
  mapLevelsToTheta,
  normalizeThetaForChart,
  type ThetaRange,
} from '@klicker-uzh/adaptive-contract'
import { mostProbableBandLabel } from './adaptivePracticeQuizTestingInfo.js'

/**
 * Display-only "rough estimate" for result nodes that have answers but no
 * reported level (below the reporting minimum, or not yet classified).
 *
 * This never changes classification, stopping, or what counts as a
 * determined level: the node keeps its INSUFFICIENT_EVIDENCE classification
 * and a null levelLabel. It only maps the persisted ability estimate onto the
 * quiz's own level scale so the student sees where the few answers point,
 * together with the (wide) plausible range.
 */
export type AdaptiveRoughEstimate = {
  roughLevelLabel: string
  position: number
  lowerPosition: number
  upperPosition: number
}

export function resolveLegacyRoughEstimate({
  estimate,
  levels,
  range,
  mappingRule,
  z,
}: {
  estimate:
    | {
        theta: number | null
        standardError: number | null
        responseCount: number
      }
    | undefined
  levels: LevelDefinition[]
  range: ThetaRange
  mappingRule: LevelMappingRule
  z: number
}): AdaptiveRoughEstimate | null {
  if (
    !estimate ||
    !(estimate.responseCount > 0) ||
    typeof estimate.theta !== 'number' ||
    !Number.isFinite(estimate.theta) ||
    levels.length === 0 ||
    !(range.max > range.min)
  ) {
    return null
  }
  // The estimator may report theta at (or beyond) the scale clamp after a few
  // all-correct or all-wrong answers; the lowest/highest band then applies.
  const theta = clamp(estimate.theta, range)
  const mapped = mapLevelsToTheta(levels, range, mappingRule)
  const level =
    mapped.find(
      (candidate) =>
        theta >= candidate.lowerBound && theta < candidate.upperBound
    ) ?? mapped.at(-1)!
  const standardError = estimate.standardError
  const hasSpread =
    typeof standardError === 'number' &&
    Number.isFinite(standardError) &&
    standardError >= 0 &&
    Number.isFinite(z) &&
    z >= 0
  return {
    roughLevelLabel: level.label,
    position: normalizeThetaForChart(theta, range),
    // Without a usable standard error the plausible range is the whole scale.
    lowerPosition: hasSpread
      ? normalizeThetaForChart(theta - z * standardError, range)
      : 0,
    upperPosition: hasSpread
      ? normalizeThetaForChart(theta + z * standardError, range)
      : 1,
  }
}

/**
 * IRT v2 rough level: the posterior's leading band when the estimator stored
 * band probabilities, otherwise the band containing the posterior mean.
 */
export function resolveV2RoughLevelLabel({
  theta,
  bandProbabilities,
  levels,
}: {
  theta: number | null
  bandProbabilities: unknown
  levels: ReadonlyArray<{
    scaleLevelId: number
    label: string
    order: number
    lowerBound: number | null
  }>
}): string | null {
  const leading = mostProbableBandLabel(
    (bandProbabilities ?? null) as Parameters<typeof mostProbableBandLabel>[0],
    levels
  )
  if (leading) return leading
  if (typeof theta !== 'number' || !Number.isFinite(theta)) return null
  const ordered = levels.slice().sort((left, right) => left.order - right.order)
  let label: string | null = ordered[0]?.label ?? null
  for (const level of ordered.slice(1)) {
    if (level.lowerBound !== null && theta >= level.lowerBound) {
      label = level.label
    }
  }
  return label
}
