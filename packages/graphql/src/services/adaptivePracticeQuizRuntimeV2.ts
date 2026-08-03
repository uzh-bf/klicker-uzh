import {
  ADAPTIVE_CLASSIFICATION_POLICY_V1,
  ADAPTIVE_V2_RANDOMIZATION_VERSION,
  AdaptiveRuntimeConfigurationError,
  type AdaptiveItemType,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveScaleDefinition,
  type AdaptiveV2PoolItem,
  type AdaptiveV2RuntimeSettings,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import {
  ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION,
  ADAPTIVE_V2_OVERLAP_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_COLLECTION_VERSION,
  ADAPTIVE_V2_STOPPING_POLICY_VERSION,
} from './adaptivePracticeQuizEstimatorIdentity.js'
import type { AdaptiveRuntimeRoutingPoolItem } from './adaptivePracticeQuizRuntime.js'
import {
  ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
  ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
} from './adaptivePracticeQuizV2Selection.js'

export type AdaptiveV2RoutingPoolItem = AdaptiveRuntimeRoutingPoolItem &
  AdaptiveV2PoolItem

type PublishedPoolItem = AdaptiveRuntimeRoutingPoolItem & {
  elementData: ElementData
  measurementVersion: DB.AdaptiveMeasurementVersion
  calibrationId: string
  itemModel: DB.AdaptiveItemModel
  role: DB.AdaptivePoolItemRole
  contributesToEstimate: boolean
}

export function preparePublishedRuntimeTopology(
  publication: DB.PracticeQuizAdaptivePublication
): {
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
} {
  const questionCaps = publication.questionCapSnapshot.node
  const nodes = publication.hierarchicalWeightSnapshot.map((entry) => ({
    id: entry.nodeId,
    parentId: entry.parentId,
    kind: entry.kind,
    depth: entry.nodePath.length,
    order: entry.order,
    enabled: entry.enabled,
    weight: entry.normalizedWeight,
    questionCap: questionCaps[String(entry.nodeId)] ?? null,
  }))
  const levels = publication.cutScoreSnapshot.map((level) => ({
    id:
      publication.measurementVersion === DB.AdaptiveMeasurementVersion.IRT_V1
        ? (level.sourceLevelId ?? level.scaleLevelId)
        : level.scaleLevelId,
    label: level.label,
    order: level.order,
  }))
  return { nodes, levels }
}

export function preparePublishedV2Scale(
  publication: DB.PracticeQuizAdaptivePublication
): AdaptiveScaleDefinition {
  const cuts = publication.cutScoreSnapshot
    .slice()
    .sort((left, right) => left.order - right.order)
  return {
    priorMean: publication.priorMean,
    priorStandardDeviation: publication.priorStandardDeviation,
    gridMin: publication.gridMin,
    gridMax: publication.gridMax,
    gridStep: publication.gridStep,
    classificationPolicyVersion: publication.classificationPolicyVersion,
    levels: cuts.map((level, index) => ({
      id: level.scaleLevelId,
      label: level.label,
      order: level.order,
      lowerBound:
        index === 0 ? Number.NEGATIVE_INFINITY : requireCut(level.lowerBound),
      upperBound:
        index === cuts.length - 1
          ? Number.POSITIVE_INFINITY
          : requireCut(cuts[index + 1]!.lowerBound),
      itemDifficultyPrior: level.itemDifficultyPrior,
    })),
  }
}

export function preparePublishedV2Settings(
  publication: DB.PracticeQuizAdaptivePublication
): AdaptiveV2RuntimeSettings {
  assertV2PublicationIdentity(publication)
  const evidence = publication.evidenceMinimumSnapshot
  const research = publication.researchAllocationPolicy
  const perLeafCaps = Object.values(publication.questionCapSnapshot.leaf)
  const distinctCaps = new Set(perLeafCaps)
  if (distinctCaps.size > 1) {
    throw configurationError(
      'Published leaf caps are inconsistent.',
      'ADAPTIVE_PUBLICATION_SNAPSHOT_INVALID'
    )
  }
  const classificationProbabilityThreshold =
    publication.classificationProbabilityThreshold
  if (classificationProbabilityThreshold === null) {
    throw configurationError(
      'The Bayesian publication has no classification threshold.',
      'ADAPTIVE_PUBLICATION_SNAPSHOT_INVALID'
    )
  }

  return {
    totalQuestionCap: publication.totalQuestionCap,
    perLeafQuestionCap: perLeafCaps[0] ?? null,
    minQuestionsPerLeaf: evidence.minimumResponsesPerLeaf,
    classificationZ: evidence.classificationZ,
    topInformationRatio: evidence.topInformationRatio,
    levelMappingRule: evidence.levelMappingRule,
    thetaRange: { min: publication.gridMin, max: publication.gridMax },
    mode: research === null ? 'DIAGNOSTIC' : 'RESEARCH',
    credibleMass: ADAPTIVE_CLASSIFICATION_POLICY_V1.credibleMass,
    classificationProbabilityThreshold,
    minimumRootResponses: evidence.minimumResponsesPerRoot,
    researchPolicy:
      research === null
        ? null
        : {
            anchorResponsesPerLeafLevel: research.minimumAnchorCountPerLeafBand,
            fieldTestResponsesPerLeaf: research.fieldTestResponsesPerLeaf,
            fieldTestInclusionProbability: research.fieldTestProbability,
            collectionDesignVersion: research.collectionDesignVersion,
          },
  }
}

export function toPublishedV2PoolItem(
  item: PublishedPoolItem
): AdaptiveV2RoutingPoolItem {
  if (
    item.measurementVersion !== DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    throw configurationError(
      'A Bayesian runtime pool contains a legacy item.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
  const itemType = item.elementType as AdaptiveItemType
  const choiceCount = getChoiceCount(item.elementData)
  const { elementData: _elementData, ...routing } = item
  return {
    ...routing,
    itemType,
    choiceCount,
    model: item.itemModel,
    calibrationId: item.calibrationId,
    contributesToEstimate: item.contributesToEstimate,
    role: item.role,
  }
}

function getChoiceCount(element: ElementData): number | null {
  switch (element.type) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM:
      return element.options.choices.length
    case DB.ElementType.NUMERICAL:
    case DB.ElementType.FREE_TEXT:
      return null
    default:
      throw configurationError(
        'The published pool contains an unsupported item type.',
        'ADAPTIVE_ELEMENT_TYPE_UNSUPPORTED'
      )
  }
}

function assertV2PublicationIdentity(
  publication: DB.PracticeQuizAdaptivePublication
) {
  if (
    publication.measurementVersion !==
      DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1 ||
    publication.estimatorImplementationVersion !==
      ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION ||
    publication.classificationPolicyVersion !==
      ADAPTIVE_CLASSIFICATION_POLICY_V1.version ||
    publication.calibrationPolicyVersion !==
      ADAPTIVE_V2_CALIBRATION_POLICY_VERSION ||
    publication.candidateSetPolicyVersion !==
      ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION ||
    publication.randomizationPolicyVersion !==
      ADAPTIVE_V2_RANDOMIZATION_VERSION ||
    publication.overlapPolicyVersion !== ADAPTIVE_V2_OVERLAP_POLICY_VERSION ||
    publication.stoppingPolicyVersion !== ADAPTIVE_V2_STOPPING_POLICY_VERSION
  ) {
    throw configurationError(
      'The Bayesian publication identity is unsupported.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
  const research = publication.researchAllocationPolicy
  if (
    research !== null &&
    (research.version !== ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION ||
      research.collectionDesignVersion !==
        ADAPTIVE_V2_RESEARCH_COLLECTION_VERSION ||
      research.splitPolicyVersion !== ADAPTIVE_V2_RANDOMIZATION_VERSION)
  ) {
    throw configurationError(
      'The Bayesian research allocation identity is unsupported.',
      'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
    )
  }
}

function requireCut(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    throw configurationError(
      'The published scale contains an invalid cut score.',
      'ADAPTIVE_PUBLICATION_SNAPSHOT_INVALID'
    )
  }
  return value
}

function configurationError(message: string, code: string) {
  return new AdaptiveRuntimeConfigurationError(message, code)
}
