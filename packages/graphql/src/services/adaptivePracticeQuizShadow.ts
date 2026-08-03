import {
  ADAPTIVE_CLASSIFICATION_POLICY_V1,
  computeAdaptiveV2Estimates,
  countAdaptiveV2Responses,
  prepareAdaptiveV2Runtime,
  type AdaptiveItemType,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeStopReason,
  type AdaptiveV2PoolItem,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import type { AdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import type { LoadedAdaptiveRuntime } from './adaptivePracticeQuizRuntimeData.js'

type ShadowEvent = Extract<
  AdaptiveOperationalEvent,
  { name: 'adaptive_irt_shadow_computed' | 'adaptive_irt_shadow_failed' }
>

export function tryComputeAdaptiveIrtV2ShadowEvent({
  runtime,
  responses,
  terminalReason,
  v1LevelId,
}: {
  runtime: LoadedAdaptiveRuntime
  responses: AdaptiveRuntimeResponse[]
  terminalReason: DB.AdaptivePracticeQuizStopReason
  v1LevelId: number | null
}): ShadowEvent | null {
  if (
    runtime.publication.measurementVersion !==
      DB.AdaptiveMeasurementVersion.IRT_V1 ||
    runtime.publication.preset !== DB.AdaptivePracticeQuizPreset.RESEARCH ||
    terminalReason === DB.AdaptivePracticeQuizStopReason.ABANDONED
  ) {
    return null
  }

  try {
    return computeAdaptiveIrtV2ShadowEvent({
      runtime,
      responses,
      terminalReason,
      v1LevelId,
    })
  } catch {
    return {
      name: 'adaptive_irt_shadow_failed',
      publicationId: runtime.publication.id,
      scaleVersionId: runtime.publication.scaleVersionId,
      reason: 'COMPUTATION_REJECTED',
    }
  }
}

function computeAdaptiveIrtV2ShadowEvent({
  runtime,
  responses,
  terminalReason,
  v1LevelId,
}: {
  runtime: LoadedAdaptiveRuntime
  responses: AdaptiveRuntimeResponse[]
  terminalReason: DB.AdaptivePracticeQuizStopReason
  v1LevelId: number | null
}): ShadowEvent {
  const publication = runtime.publication
  const sourceToScaleLevel = new Map(
    publication.cutScoreSnapshot.flatMap((level) =>
      level.sourceLevelId === null
        ? []
        : [[level.sourceLevelId, level.scaleLevelId] as const]
    )
  )
  const pool: AdaptiveV2PoolItem[] = runtime.publishedPool.map((item) => ({
    id: item.id,
    leafNodeId: item.leafNodeId,
    nodePath: item.nodePath,
    levelId: requireScaleLevelId(item.levelId, sourceToScaleLevel),
    discrimination: item.discrimination,
    difficulty: item.difficulty,
    guessing: item.guessing,
    itemType: item.elementType as AdaptiveItemType,
    choiceCount: adaptiveChoiceCount(item.elementData),
    model: item.itemModel,
    calibrationId: item.calibrationId,
    contributesToEstimate: true,
    role: 'SCORING',
  }))
  const prepared = prepareAdaptiveV2Runtime({
    nodes: runtime.algorithm.nodes,
    scale: {
      priorMean: publication.priorMean,
      priorStandardDeviation: publication.priorStandardDeviation,
      gridMin: publication.gridMin,
      gridMax: publication.gridMax,
      gridStep: publication.gridStep,
      classificationPolicyVersion: publication.classificationPolicyVersion,
      levels: publication.cutScoreSnapshot
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((level, index, levels) => ({
          id: level.scaleLevelId,
          label: level.label,
          order: level.order,
          lowerBound:
            index === 0
              ? Number.NEGATIVE_INFINITY
              : requireFiniteCut(level.lowerBound),
          upperBound:
            index === levels.length - 1
              ? Number.POSITIVE_INFINITY
              : requireFiniteCut(levels[index + 1]!.lowerBound),
          itemDifficultyPrior: level.itemDifficultyPrior,
        })),
    },
    pool,
    settings: {
      totalQuestionCap: publication.totalQuestionCap,
      perLeafQuestionCap:
        Object.values(publication.questionCapSnapshot.leaf)[0] ?? null,
      minQuestionsPerLeaf:
        publication.evidenceMinimumSnapshot.minimumResponsesPerLeaf,
      classificationZ: publication.evidenceMinimumSnapshot.classificationZ,
      topInformationRatio:
        publication.evidenceMinimumSnapshot.topInformationRatio,
      levelMappingRule: publication.evidenceMinimumSnapshot.levelMappingRule,
      thetaRange: { min: publication.gridMin, max: publication.gridMax },
      mode: 'DIAGNOSTIC',
      credibleMass: ADAPTIVE_CLASSIFICATION_POLICY_V1.credibleMass,
      classificationProbabilityThreshold:
        ADAPTIVE_CLASSIFICATION_POLICY_V1.minimumProbabilityThreshold,
      minimumRootResponses:
        publication.evidenceMinimumSnapshot.minimumResponsesPerRoot,
      researchPolicy: null,
    },
  })
  const poolById = new Map(prepared.pool.map((item) => [item.id, item]))
  const shadowResponses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[] =
    responses.map((response) => ({
      order: response.order,
      poolItemId: response.poolItemId,
      correct: response.correct,
      poolItem: requirePoolItem(response.poolItemId, poolById),
    }))
  const estimates = computeAdaptiveV2Estimates({
    runtime: prepared,
    responses: shadowResponses,
    eligibleScoringItems: [...prepared.pool],
    counts: countAdaptiveV2Responses(shadowResponses),
    terminalReason: toRuntimeStopReason(terminalReason),
  })
  const v1LevelOrder =
    v1LevelId === null
      ? null
      : (publication.cutScoreSnapshot.find(
          (level) => level.sourceLevelId === v1LevelId
        )?.order ?? null)
  const leadingScaleLevelId = selectLeadingScaleLevelId(estimates.overall)
  const v2LeadingLevelOrder =
    leadingScaleLevelId === null
      ? null
      : (publication.cutScoreSnapshot.find(
          (level) => level.scaleLevelId === leadingScaleLevelId
        )?.order ?? null)

  return {
    name: 'adaptive_irt_shadow_computed',
    publicationId: publication.id,
    scaleVersionId: publication.scaleVersionId,
    differenceBucket: differenceBucket(v1LevelOrder, v2LeadingLevelOrder),
    v1LevelOrder,
    v2LeadingLevelOrder,
  }
}

function selectLeadingScaleLevelId(
  estimate: ReturnType<typeof computeAdaptiveV2Estimates>['overall']
) {
  if (estimate.classifiedLevelId !== null) return estimate.classifiedLevelId
  if (estimate.leadingLevelIds.length === 0) return null
  return estimate.leadingLevelIds
    .map((levelId) => ({
      levelId,
      probability:
        estimate.posterior.bandProbabilities.find(
          (entry) => entry.levelId === levelId
        )?.probability ?? 0,
    }))
    .sort(
      (left, right) =>
        right.probability - left.probability || left.levelId - right.levelId
    )[0]!.levelId
}

function differenceBucket(
  v1LevelOrder: number | null,
  v2LevelOrder: number | null
): Extract<
  ShadowEvent,
  { name: 'adaptive_irt_shadow_computed' }
>['differenceBucket'] {
  if (v1LevelOrder === null) return 'V1_UNCLASSIFIED'
  if (v2LevelOrder === null) return 'V2_UNCLASSIFIED'
  const difference = v2LevelOrder - v1LevelOrder
  if (difference === 0) return 'SAME_LEVEL'
  if (difference === 1) return 'V2_ONE_LEVEL_HIGHER'
  if (difference === -1) return 'V2_ONE_LEVEL_LOWER'
  return difference > 0
    ? 'V2_AT_LEAST_TWO_LEVELS_HIGHER'
    : 'V2_AT_LEAST_TWO_LEVELS_LOWER'
}

function requireScaleLevelId(
  sourceLevelId: number,
  sourceToScaleLevel: ReadonlyMap<number, number>
) {
  const scaleLevelId = sourceToScaleLevel.get(sourceLevelId)
  if (scaleLevelId === undefined) {
    throw new Error('Legacy publication item has no snapshotted scale level.')
  }
  return scaleLevelId
}

function requirePoolItem(
  poolItemId: number,
  poolById: ReadonlyMap<number, AdaptiveV2PoolItem>
) {
  const item = poolById.get(poolItemId)
  if (!item) throw new Error('Shadow response references an unknown pool item.')
  return item
}

function requireFiniteCut(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    throw new Error('Shadow scale contains an invalid cut score.')
  }
  return value
}

function adaptiveChoiceCount(elementData: ElementData): number | null {
  switch (elementData.type) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM:
      return elementData.options.choices.length
    case DB.ElementType.NUMERICAL:
    case DB.ElementType.FREE_TEXT:
      return null
    default:
      throw new Error('Shadow pool contains an unsupported item type.')
  }
}

function toRuntimeStopReason(
  reason: DB.AdaptivePracticeQuizStopReason
): AdaptiveRuntimeStopReason {
  switch (reason) {
    case DB.AdaptivePracticeQuizStopReason.CLASSIFIED:
    case DB.AdaptivePracticeQuizStopReason.ALL_ROOTS_CLASSIFIED:
    case DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP:
    case DB.AdaptivePracticeQuizStopReason.NODE_QUESTION_CAP:
    case DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED:
    case DB.AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA:
    case DB.AdaptivePracticeQuizStopReason.ABANDONED:
      return reason
  }
}
