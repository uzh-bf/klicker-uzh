import {
  classificationIntervalWithinLevelBand,
  isNearLevelBoundary,
  levelMasteryOf,
} from '@klicker-uzh/adaptive-contract'
import type * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeSettings,
  MIN_REPORTING_RESPONSES,
  normalizeRuntimeEstimateForChart,
} from './adaptivePracticeQuizRuntime.js'

type ReportedEstimate = Pick<
  DB.AdaptivePracticeQuizEstimate,
  'theta' | 'standardError' | 'responseCount' | 'levelId'
>

export const NO_MASTERY = { mastered: null, nextLevelLabel: null } as const

export function serializeEstimateView({
  estimate,
  levelsById,
  settings,
}: {
  estimate: ReportedEstimate | undefined
  levelsById: Map<number, AdaptiveRuntimeLevel>
  settings: AdaptiveRuntimeSettings
}) {
  if (
    !estimate ||
    estimate.responseCount < MIN_REPORTING_RESPONSES ||
    estimate.theta === null ||
    estimate.standardError === null ||
    estimate.levelId === null
  ) {
    return {
      levelLabel: null,
      confidence: 'INSUFFICIENT_DATA' as const,
      nearBoundary: false,
      position: null,
      lowerPosition: null,
      upperPosition: null,
    }
  }
  const level = levelsById.get(estimate.levelId)
  const normalized = normalizeRuntimeEstimateForChart({ estimate, settings })!
  const classified = classificationIntervalWithinLevelBand({
    theta: estimate.theta,
    standardError: estimate.standardError,
    levels: [...levelsById.values()],
    range: settings.thetaRange,
    mappingRule: settings.levelMappingRule,
    reachedFrom: settings.levelReachedFrom ?? 0,
    z: settings.classificationZ,
    toleranceBands: settings.classificationToleranceBands ?? 0,
  })
  const nearBoundary = isNearLevelBoundary({
    theta: estimate.theta,
    levels: [...levelsById.values()],
    range: settings.thetaRange,
    mappingRule: settings.levelMappingRule,
    reachedFrom: settings.levelReachedFrom ?? 0,
    margin: settings.classificationZ * estimate.standardError,
  })
  return {
    levelLabel: level?.label ?? null,
    confidence: classified
      ? ('HIGH' as const)
      : nearBoundary
        ? ('LOW' as const)
        : ('MODERATE' as const),
    nearBoundary,
    ...normalized,
  }
}

/**
 * Mastery indication of a reported level (`levelMasteryOf`); it annotates
 * the level and never changes it.
 */
export function serializeMasteryView({
  estimate,
  levelsById,
  settings,
  masteryFrom,
}: {
  estimate: Pick<ReportedEstimate, 'theta' | 'levelId'> | undefined
  levelsById: Map<number, AdaptiveRuntimeLevel>
  settings: AdaptiveRuntimeSettings
  masteryFrom: number
}) {
  const level =
    estimate?.levelId != null ? levelsById.get(estimate.levelId) : undefined
  if (!level || estimate?.theta == null) return NO_MASTERY
  const levels = [...levelsById.values()].sort((a, b) => a.order - b.order)
  const mastery = levelMasteryOf({
    theta: estimate.theta,
    levels,
    range: settings.thetaRange,
    mappingRule: settings.levelMappingRule,
    masteryFrom,
  })
  return {
    // Only for the band of the reported level, so it never contradicts it.
    mastered: mastery?.order === level.order ? mastery.mastered : null,
    nextLevelLabel: levels[levels.indexOf(level) + 1]?.label ?? null,
  }
}
