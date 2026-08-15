import { PrismaClient } from '@klicker-uzh/prisma/client'
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

type KBGraphMeteredCost = {
  currency: string
  amount_minor_units: number
  components: Array<{
    provider: string
    model: string
    amount_minor_units: number
    pricing_version: string
    embedding_tokens: number
    input_tokens: number
    output_tokens: number
    request_count: number
  }>
  metering_source: 'provider_reported' | 'configured_pricing'
}

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
    type PrismaAssessmentReportSnapshot = AssessmentReportSnapshotV1
    type PrismaKBGraphMeteredCost = KBGraphMeteredCost
  }
}
// #endregion
