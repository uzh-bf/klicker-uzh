import {
  PrismaClient,
  type AdaptiveEstimateNodeKind,
  type ElementType,
} from '@klicker-uzh/prisma/client'
import type {
  ActivityLogModificationDetails,
  AssessmentReportSnapshotV1,
  AvatarSettings,
  ElementData,
  ElementInstanceOptions,
  ElementInstanceResults,
  ElementOptions,
  GroupActivityDecisions,
  GroupActivityResults,
  SingleQuestionResponse,
  SingleQuestionResponseLiveQuiz,
} from '@klicker-uzh/types'

export type PrismaMigrationClient = Omit<
  InstanceType<typeof PrismaClient>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ----- AVATAR SETTINGS -----
// #region
declare global {
  namespace PrismaJson {
    type PrismaAvatarSettings = AvatarSettings
  }
}
// #endregion

// ----- ELEMENT DATA AND INSTANCES -----
// #region

declare global {
  namespace PrismaJson {
    type AdaptivePrivacyField =
      | 'DISTRIBUTION'
      | 'RESULT_CLASSIFICATION'
      | 'CLASSIFIED'
      | 'CAPPED'
      | 'POOL_EXHAUSTED'
      | 'STOPPED_INSUFFICIENT_DATA'
      | 'INSUFFICIENT_DATA'
      | 'NEAR_BOUNDARY'
      | 'QUESTION_COUNT_PERCENTILES'
      | 'DURATION_PERCENTILES'
      | 'RESPONSE_COUNT_MISMATCH'
      | 'DURATION_MISSING'
      | 'ITEM_EXPOSURE'
      | 'ITEM_ACCURACY'
      | 'ITEM_RESIDUAL'
    type AdaptivePrivacySuppressionReason =
      | 'BELOW_RELEASE_THRESHOLD'
      | 'SMALL_CELL_OR_COMPLEMENT'
      | 'SMALL_KNOWN_OR_MISSING_PARTITION'
      | 'MINIMUM_RESPONSES'
    type AdaptivePrivacySuppression = {
      field: AdaptivePrivacyField
      reason: AdaptivePrivacySuppressionReason
    }
    type PrismaAdaptiveBandProbabilities = Record<string, number>
    type PrismaAdaptiveCutRationale = Array<{
      scaleLevelOrder: number
      codes: string[]
      note?: string
    }>
    type PrismaAdaptiveScaleLinkMetrics = Record<string, number | string | null>
    type PrismaAdaptiveParameterUncertainty = {
      discriminationStandardError: number | null
      difficultyStandardError: number | null
      guessingStandardError: number | null
      discriminationInterval: [number, number] | null
      difficultyInterval: [number, number] | null
      guessingInterval: [number, number] | null
    }
    type PrismaAdaptiveCalibrationDiagnostics = {
      fitStatus: 'PASS' | 'WARN' | 'FAIL'
      difStatus: 'PASS' | 'WARN' | 'FAIL'
      driftStatus: 'PASS' | 'WARN' | 'FAIL'
      fitStatistics: Record<string, number | null>
      warningCodes: string[]
      dif: Record<string, number | string | null>
      drift: Record<string, number | string | null>
    }
    type PrismaAdaptiveCutScoreSnapshot = Array<{
      scaleLevelId: number
      sourceLevelId: number | null
      order: number
      label: string
      lowerBound: number | null
      itemDifficultyPrior: number
    }>
    type PrismaAdaptiveHierarchicalWeightSnapshot = Array<{
      nodeId: number
      name: string
      parentId: number | null
      kind: 'COMPETENCE' | 'SUBCOMPETENCE'
      depth: number
      order: number
      nodePath: number[]
      enabled: boolean
      normalizedWeight: number
      effectiveLeafWeight: number | null
    }>
    type PrismaAdaptiveEvidenceMinimumSnapshot = {
      minimumResponsesPerLeaf: number
      minimumResponsesPerRoot: number
      requiredRootIds: number[]
      classificationZ: number
      topInformationRatio: number
      levelMappingRule: 'NEAREST' | 'MASTERY'
      thetaMin: number
      thetaMax: number
    }
    type PrismaAdaptiveQuestionCapSnapshot = {
      root: Record<string, number | null>
      node: Record<string, number | null>
      leaf: Record<string, number | null>
    }
    type PrismaAdaptiveResearchAllocationPolicy = {
      version: string
      anchorProbability: number
      fieldTestProbability: number
      collectionDesignVersion: string
      minimumAnchorCountPerLeafBand: number
      fieldTestResponsesPerLeaf: number
      minimumDistinctAnchorItemsPerLeafBand: number
      minimumDistinctFieldTestItemsPerLeaf: number
      splitPolicyVersion: string
    }
    type PrismaAdaptiveValidationInterval = {
      lower: number
      upper: number
      confidenceLevel: number
    }
    type PrismaAdaptiveValidationMetrics = {
      exactAgreement: number
      adjacentAgreement: number
      meanAbsoluteLevelError: number
      capRate: number
      maximumExposure: number
      calibrationError: number
      logLoss: number
      exactAgreementInterval: PrismaAdaptiveValidationInterval
      adjacentAgreementInterval: PrismaAdaptiveValidationInterval
      capRateInterval: PrismaAdaptiveValidationInterval
      maximumExposureInterval: PrismaAdaptiveValidationInterval
    }
    type PrismaAdaptiveValidationStratumMetrics = Array<{
      key: string
      learnerCount: number
      metrics: PrismaAdaptiveValidationMetrics
    }>
    type PrismaSingleQuestionResponse = SingleQuestionResponse
    type PrismaSingleQuestionResponseLiveQuiz =
      SingleQuestionResponseLiveQuiz | null
    type PrismaElementOptions = ElementOptions
    type PrismaElementResults = ElementInstanceResults
    type PrismaElementData = ElementData
    type PrismaElementInstanceOptions = ElementInstanceOptions
    type PrismaGroupActivityDecisions = GroupActivityDecisions
    type PrismaGroupActivityResults = GroupActivityResults
    type PrismaActivityLogModificationDetails = ActivityLogModificationDetails
    type PrismaAdaptivePracticeQuizCohortSnapshot =
      | {
          schemaVersion: 1
          result: Record<string, unknown>
        }
      | {
          schemaVersion: 2
          result: {
            practiceQuizId: string
            cohortSize: number | null
            suppressed: boolean
            attemptSummary: {
              suppressed: boolean
              suppressions: AdaptivePrivacySuppression[]
              classified: number | null
              betweenLevels: number | null
              insufficientEvidence: number | null
              poolLimited: number | null
              researchOnly: number | null
              capped: number | null
              poolExhausted: number | null
              stoppedInsufficientData: number | null
              insufficientData: number | null
              nearBoundary: number | null
            }
            pilotMetrics: {
              suppressed: boolean
              suppressions: AdaptivePrivacySuppression[]
              medianQuestionCount: number | null
              p95QuestionCount: number | null
              medianElapsedSeconds: number | null
              p95ElapsedSeconds: number | null
              nearBoundaryRate: number | null
              responseCountMismatchDetected: boolean | null
              durationMissingDetected: boolean | null
            }
            itemDiagnostics: Array<{
              poolItemId: number
              elementName: string
              elementType: ElementType
              nodeNamePath: string[]
              levelLabel: string
              suppressed: boolean
              suppressions: AdaptivePrivacySuppression[]
              responseCount: number | null
              exposureRate: number | null
              observedCorrectRate: number | null
              expectedCorrectRate: number | null
              residual: number | null
              highExposure: boolean | null
              misfitFlag: boolean | null
            }>
            distributions: Array<{
              nodeId: number | null
              parentNodeId: number | null
              nodeName: string
              nodeKind: AdaptiveEstimateNodeKind
              depth: number
              order: number
              suppressed: boolean
              suppressions: AdaptivePrivacySuppression[]
              classifiedCount: number | null
              betweenLevelsCount: number | null
              insufficientEvidenceCount: number | null
              poolLimitedCount: number | null
              researchOnlyCount: number | null
              insufficientDataCount: number | null
              buckets: Array<{
                levelLabel: string
                levelOrder: number
                count: number
              }>
            }>
          }
        }
    type PrismaAssessmentReportSnapshot = AssessmentReportSnapshotV1
  }
}
// #endregion
