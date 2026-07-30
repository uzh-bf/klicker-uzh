import {
  PrismaClient,
  type AdaptiveEstimateNodeKind,
  type ElementType,
} from '@klicker-uzh/prisma/client'
import type {
  ActivityLogModificationDetails,
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
    type PrismaAdaptivePracticeQuizCohortSnapshot = {
      schemaVersion: 1
      result: {
        practiceQuizId: string
        cohortSize: number | null
        suppressed: boolean
        attemptSummary: {
          suppressed: boolean
          suppressions: AdaptivePrivacySuppression[]
          classified: number | null
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
          insufficientDataCount: number | null
          buckets: Array<{
            levelLabel: string
            levelOrder: number
            count: number
          }>
        }>
      }
    }
  }
}
// #endregion
