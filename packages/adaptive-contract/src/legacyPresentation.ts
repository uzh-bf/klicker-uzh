import {
  DEFAULT_THETA_RANGE,
  type LevelDefinition,
  type LevelMappingRule,
  mapLevelsToTheta,
  normalizeThetaForChart,
  type ThetaRange,
} from './core.js'
import type {
  AdaptiveRuntimeEstimate,
  AdaptiveRuntimeSettings,
} from './runtime.js'

// Interpret already-persisted legacy estimates against their published scale.
// This module never fits an estimator, selects an item, or stops an attempt.
type NormalizedAdaptiveEstimate = {
  position: number
  lowerPosition: number
  upperPosition: number
}

export function normalizeAdaptiveEstimateForChart({
  theta,
  standardError,
  range = DEFAULT_THETA_RANGE,
  z = 1.28,
}: {
  theta: number
  standardError: number
  range?: ThetaRange
  z?: number
}): NormalizedAdaptiveEstimate {
  if (
    !Number.isFinite(standardError) ||
    standardError < 0 ||
    !Number.isFinite(z) ||
    z < 0
  ) {
    throw new TypeError(
      'A finite non-negative standard error and z value are required.'
    )
  }

  return {
    position: normalizeThetaForChart(theta, range),
    lowerPosition: normalizeThetaForChart(theta - z * standardError, range),
    upperPosition: normalizeThetaForChart(theta + z * standardError, range),
  }
}

export function classificationIntervalWithinLevelBand({
  theta,
  standardError,
  levels,
  range = DEFAULT_THETA_RANGE,
  mappingRule = 'NEAREST',
  z = 1.28,
}: {
  theta: number
  standardError: number
  levels: LevelDefinition[]
  range?: ThetaRange
  mappingRule?: LevelMappingRule
  z?: number
}) {
  if (!Number.isFinite(standardError) || standardError < 0) return false

  const lower = theta - z * standardError
  const upper = theta + z * standardError
  const mappedLevels = mapLevelsToTheta(levels, range, mappingRule)

  return mappedLevels.some(
    (level) => lower >= level.lowerBound && upper < level.upperBound
  )
}

export function isNearLevelBoundary({
  theta,
  levels,
  range = DEFAULT_THETA_RANGE,
  mappingRule = 'NEAREST',
  margin,
}: {
  theta: number
  levels: LevelDefinition[]
  range?: ThetaRange
  mappingRule?: LevelMappingRule
  margin: number
}) {
  const boundaries = mapLevelsToTheta(levels, range, mappingRule)
    .flatMap((level) => [level.lowerBound, level.upperBound])
    .filter((boundary) => Number.isFinite(boundary))

  return boundaries.some((boundary) => Math.abs(theta - boundary) <= margin)
}

export function normalizeAdaptiveRuntimeEstimateForChart({
  estimate,
  settings,
}: {
  estimate: Pick<AdaptiveRuntimeEstimate, 'theta' | 'standardError'>
  settings: Pick<AdaptiveRuntimeSettings, 'thetaRange' | 'classificationZ'>
}) {
  if (estimate.theta === null || estimate.standardError === null) return null
  return normalizeAdaptiveEstimateForChart({
    theta: estimate.theta,
    standardError: estimate.standardError,
    range: settings.thetaRange,
    z: settings.classificationZ,
  })
}
