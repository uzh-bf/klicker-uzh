import { ADAPTIVE_V2_EXPOSURE_CEILING } from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF,
} from './adaptivePracticeQuizEstimatorIdentity.js'
import { checksum } from './competenceTreeCalibrationCommandUtils.js'

type FingerprintConfig = Pick<
  DB.PracticeQuizAdaptiveConfig,
  | 'id'
  | 'competenceTreeId'
  | 'scaleVersionId'
  | 'measurementVersion'
  | 'calibrationPolicyVersion'
  | 'preset'
  | 'attemptSelectionPolicy'
  | 'totalQuestionCap'
  | 'perLeafQuestionCap'
  | 'minQuestionsPerLeaf'
>

type FingerprintPrepared = {
  nodes: Array<{
    id: number
    parentId: number | null
    enabled: boolean
    weight: number | null
    questionCap: number | null
  }>
  assignments: Array<{
    id: number
    elementId: number
    elementVersion: number
    leafNodeId: number
    levelId: number
    enabled: boolean
  }>
}

type FingerprintScale = Pick<
  DB.CompetenceTreeScaleVersion,
  | 'id'
  | 'version'
  | 'priorMean'
  | 'priorStandardDeviation'
  | 'gridMin'
  | 'gridMax'
  | 'gridStep'
  | 'classificationPolicyVersion'
> & {
  levels: Array<
    Pick<
      DB.CompetenceTreeScaleLevel,
      | 'id'
      | 'sourceLevelId'
      | 'order'
      | 'label'
      | 'lowerBound'
      | 'itemDifficultyPrior'
    >
  >
}

export function buildAdaptiveV2ConfigFingerprint({
  config,
  prepared,
  scale,
  bankFingerprint,
}: {
  config: FingerprintConfig
  prepared: FingerprintPrepared
  scale: FingerprintScale
  bankFingerprint: string
}) {
  return checksum({
    configId: config.id,
    treeId: config.competenceTreeId,
    scaleVersionId: config.scaleVersionId,
    scaleVersion: scale.version,
    measurementVersion: config.measurementVersion,
    estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
    classificationPolicyVersion: scale.classificationPolicyVersion,
    calibrationPolicyVersion: config.calibrationPolicyVersion,
    preset: config.preset,
    attemptSelectionPolicy: config.attemptSelectionPolicy,
    totalQuestionCap: config.totalQuestionCap,
    perLeafQuestionCap: config.perLeafQuestionCap,
    minQuestionsPerLeaf: config.minQuestionsPerLeaf,
    scale: {
      priorMean: scale.priorMean,
      priorStandardDeviation: scale.priorStandardDeviation,
      gridMin: scale.gridMin,
      gridMax: scale.gridMax,
      gridStep: scale.gridStep,
      levels: scale.levels.map((level) => ({
        id: level.id,
        sourceLevelId: level.sourceLevelId,
        order: level.order,
        label: level.label,
        lowerBound: level.lowerBound,
        itemDifficultyPrior: level.itemDifficultyPrior,
      })),
    },
    nodes: prepared.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      enabled: node.enabled,
      weight: node.weight,
      questionCap: node.questionCap,
    })),
    assignments: prepared.assignments.map((assignment) => ({
      id: assignment.id,
      elementId: assignment.elementId,
      elementVersion: assignment.elementVersion,
      leafNodeId: assignment.leafNodeId,
      levelId: assignment.levelId,
      enabled: assignment.enabled,
    })),
    policies: {
      candidateSet: 'irt-v2-top-information-randomized-v1',
      randomization: 'irt-v2-hmac-draw-v1',
      exposureCeiling: ADAPTIVE_V2_EXPOSURE_CEILING,
      overlap: 'irt-v2-first-exposure-overlap-v1',
      stopping: 'irt-v2-posterior-band-mass-v1',
      researchAllocation:
        config.preset === DB.AdaptivePracticeQuizPreset.RESEARCH
          ? {
              version: ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION,
              anchorResponsesPerLeafLevel:
                ADAPTIVE_V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL,
              fieldTestResponsesPerLeaf:
                ADAPTIVE_V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF,
              minimumDistinctAnchorItemsPerLeafBand:
                ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
              minimumDistinctFieldTestItemsPerLeaf:
                ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
              scoringRedundancyPerLeaf:
                ADAPTIVE_V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF,
            }
          : null,
    },
    bankFingerprint,
  })
}
