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

/**
 * Tolerance rule shared with Catalyst SEQUENTIAL_ROOTS_V6: the interval
 * [lower, upper) must lie within bands k−t … k+t (clipped at both ends) around
 * the band k containing θ. `bands` must be ordered and contiguous. With t = 0
 * this is exactly "the interval lies within one band". The reported level
 * stays band k.
 */
export function intervalWithinToleranceBands({
  theta,
  lower,
  upper,
  bands,
  toleranceBands = 0,
}: {
  theta: number
  lower: number
  upper: number
  bands: ReadonlyArray<{ lowerBound: number; upperBound: number }>
  toleranceBands?: number
}) {
  const index = bands.findIndex(
    (band) => theta >= band.lowerBound && theta < band.upperBound
  )
  if (index === -1) return false
  const tolerance = Math.max(0, Math.floor(toleranceBands))
  const first = bands[Math.max(0, index - tolerance)]!
  const last = bands[Math.min(bands.length - 1, index + tolerance)]!
  return lower >= first.lowerBound && upper < last.upperBound
}

export function classificationIntervalWithinLevelBand({
  theta,
  standardError,
  levels,
  range = DEFAULT_THETA_RANGE,
  mappingRule = 'NEAREST',
  z = 1.28,
  toleranceBands = 0,
}: {
  theta: number
  standardError: number
  levels: LevelDefinition[]
  range?: ThetaRange
  mappingRule?: LevelMappingRule
  z?: number
  toleranceBands?: number
}) {
  if (!Number.isFinite(standardError) || standardError < 0) return false

  return intervalWithinToleranceBands({
    theta,
    lower: theta - z * standardError,
    upper: theta + z * standardError,
    bands: mapLevelsToTheta(levels, range, mappingRule),
    toleranceBands,
  })
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
