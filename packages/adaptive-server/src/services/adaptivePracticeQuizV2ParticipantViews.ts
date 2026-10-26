import { normalizeThetaForChart } from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import type { LoadedAdaptiveRuntime } from './adaptivePracticeQuizRuntimeData.js'
import { competenceTreeLevelColorsById } from './competenceTreeLevelColors.js'

export function serializeV2EstimateView({
  estimate,
  levels,
  runtime,
}: {
  estimate: DB.AdaptivePracticeQuizEstimate
  levels: LoadedAdaptiveRuntime['publication']['cutScoreSnapshot']
  runtime: LoadedAdaptiveRuntime
}) {
  const classification = estimate.resultStatus
  if (!classification) {
    throw adaptivePracticeQuizError(
      'The Bayesian estimate has no result classification.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  const researchOnly = classification === DB.AdaptiveResultStatus.RESEARCH_ONLY
  const hasPosition =
    !researchOnly &&
    estimate.theta !== null &&
    estimate.credibleLower !== null &&
    estimate.credibleUpper !== null
  const level =
    classification === DB.AdaptiveResultStatus.CLASSIFIED
      ? levels.find(({ sourceLevelId }) => sourceLevelId === estimate.levelId)
      : null
  const leadingLevelLabels =
    classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS
      ? leadingAdjacentLevelLabels(estimate.bandProbabilities, levels)
      : []
  return {
    classification,
    levelLabel: level?.label ?? null,
    leadingLevelLabels,
    classificationProbability:
      runtime.publication.preset !== DB.AdaptivePracticeQuizPreset.PLACEMENT &&
      (classification === DB.AdaptiveResultStatus.CLASSIFIED ||
        classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS)
        ? estimate.classificationProbability
        : null,
    confidence:
      classification === DB.AdaptiveResultStatus.CLASSIFIED
        ? ('HIGH' as const)
        : classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS
          ? ('LOW' as const)
          : ('INSUFFICIENT_DATA' as const),
    nearBoundary: classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS,
    position: hasPosition
      ? normalizeV2Position(estimate.theta!, runtime)
      : null,
    lowerPosition: hasPosition
      ? normalizeV2Position(estimate.credibleLower!, runtime)
      : null,
    upperPosition: hasPosition
      ? normalizeV2Position(estimate.credibleUpper!, runtime)
      : null,
  }
}

export function serializeV2LevelBands(runtime: LoadedAdaptiveRuntime) {
  const levels = runtime.publication.cutScoreSnapshot
    .slice()
    .sort((left, right) => left.order - right.order)
  // Colors are cosmetic and resolved live from the source tree levels, so a
  // lecturer can change them without republishing.
  const colors = competenceTreeLevelColorsById(runtime.tree.levels)
  return levels.map((level, index) => ({
    label: level.label,
    order: level.order,
    color:
      level.sourceLevelId === null
        ? null
        : (colors.get(level.sourceLevelId) ?? null),
    startPosition: normalizeV2Position(
      index === 0
        ? runtime.publication.gridMin
        : (level.lowerBound ?? runtime.publication.gridMin),
      runtime
    ),
    endPosition: normalizeV2Position(
      index === levels.length - 1
        ? runtime.publication.gridMax
        : (levels[index + 1]!.lowerBound ?? runtime.publication.gridMax),
      runtime
    ),
  }))
}

export function normalizeV2Position(
  theta: number,
  runtime: LoadedAdaptiveRuntime
) {
  return normalizeThetaForChart(theta, {
    min: runtime.publication.gridMin,
    max: runtime.publication.gridMax,
  })
}

function leadingAdjacentLevelLabels(
  probabilities: DB.Prisma.JsonValue | null,
  levels: LoadedAdaptiveRuntime['publication']['cutScoreSnapshot']
) {
  if (!probabilities || typeof probabilities !== 'object') return []
  const values = probabilities as Record<string, number>
  const ordered = levels.slice().sort((left, right) => left.order - right.order)
  const topIndex = ordered.reduce(
    (best, level, index) =>
      (values[String(level.scaleLevelId)] ?? 0) >
      (values[String(ordered[best]!.scaleLevelId)] ?? 0)
        ? index
        : best,
    0
  )
  const neighborIndices = [topIndex - 1, topIndex + 1].filter(
    (index) => index >= 0 && index < ordered.length
  )
  const neighborIndex = neighborIndices.sort(
    (left, right) =>
      (values[String(ordered[right]!.scaleLevelId)] ?? 0) -
      (values[String(ordered[left]!.scaleLevelId)] ?? 0)
  )[0]
  return [topIndex, neighborIndex]
    .filter((index): index is number => typeof index === 'number')
    .sort((left, right) => left - right)
    .map((index) => ordered[index]!.label)
}
