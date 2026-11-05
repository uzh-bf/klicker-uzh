import {
  mapLevelsToTheta,
  normalizeThetaForChart,
} from '@klicker-uzh/adaptive-contract'
import type {
  AdaptiveRuntimeLevel,
  AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'

// Legacy (IRT_V1) level scale helpers shared by the result and testing views.

export function serializeLevelBands(
  levels: AdaptiveRuntimeLevel[],
  settings: AdaptiveRuntimeSettings,
  colorsByLevelId: ReadonlyMap<number, string> = new Map()
) {
  return mapLevelsToTheta(
    levels,
    settings.thetaRange,
    settings.levelMappingRule
  ).map((level) => ({
    label: level.label,
    order: level.order,
    // Legacy runtime level ids are the source competence tree level ids.
    color:
      colorsByLevelId.get(
        levels.find((candidate) => candidate.order === level.order)?.id ?? -1
      ) ?? null,
    startPosition: normalizeThetaForChart(
      Number.isFinite(level.lowerBound)
        ? level.lowerBound
        : settings.thetaRange.min,
      settings.thetaRange
    ),
    endPosition: normalizeThetaForChart(
      Number.isFinite(level.upperBound)
        ? level.upperBound
        : settings.thetaRange.max,
      settings.thetaRange
    ),
  }))
}

export function mapLevelForTheta(
  theta: number,
  levels: AdaptiveRuntimeLevel[],
  settings: AdaptiveRuntimeSettings
) {
  const mapped = mapLevelsToTheta(
    levels,
    settings.thetaRange,
    settings.levelMappingRule
  ).find((level) => theta >= level.lowerBound && theta < level.upperBound)
  return mapped
    ? levels.find(
        (level) => level.label === mapped.label && level.order === mapped.order
      )
    : levels.at(-1)
}
