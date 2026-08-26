import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  ActivityLogModificationDetails,
  AssessmentReportSnapshot,
  AvatarSettings,
  ElementData,
  ElementInstanceOptions,
  ElementInstanceResults,
  ElementOptions,
  FlashcardGenerationConfiguration,
  GeneratedFlashcard,
  GeneratedFlashcardEditable,
  GeneratedQuestionCitation,
  GeneratedQuestionEditable,
  GeneratedQuestionOriginal,
  GroupActivityDecisions,
  GroupActivityResults,
  QuestionGenerationArtifactRef,
  QuestionGenerationConfiguration,
  QuestionGenerationDesignSummary,
  QuestionGenerationPlanSummary,
  QuestionGenerationQuestionProvenance,
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
    type PrismaAssessmentReportSnapshot = AssessmentReportSnapshot
    type PrismaKBGraphMeteredCost = KBGraphMeteredCost
    type PrismaElementGenerationArtifactRef = QuestionGenerationArtifactRef
    type PrismaElementGenerationConfiguration =
      | QuestionGenerationConfiguration
      | FlashcardGenerationConfiguration
    type PrismaElementGenerationDesignSummary = QuestionGenerationDesignSummary
    type PrismaElementGenerationPlanSummary = QuestionGenerationPlanSummary
    type PrismaGeneratedElementOriginal =
      | GeneratedQuestionOriginal
      | GeneratedFlashcard
    type PrismaGeneratedElementEditable =
      | GeneratedQuestionEditable
      | GeneratedFlashcardEditable
    type PrismaGeneratedElementCitations = GeneratedQuestionCitation[]
    type PrismaElementGenerationProvenance =
      QuestionGenerationQuestionProvenance
  }
}
// #endregion
