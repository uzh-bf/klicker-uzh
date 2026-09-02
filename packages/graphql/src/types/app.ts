import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  ActivityLogModificationDetails,
  AssessmentReportSnapshot,
  AvatarSettings,
  ElementData,
  ElementInstanceOptions,
  ElementInstanceResults,
  ElementOptions,
  GroupActivityDecisions,
  GroupActivityResults,
  PeerInstructionComparison,
  PeerInstructionRunState,
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
    type PrismaSingleQuestionResponse = SingleQuestionResponse
    type PrismaSingleQuestionResponseLiveQuiz =
      SingleQuestionResponseLiveQuiz | null
    type PrismaElementOptions = ElementOptions
    type PrismaElementResults = ElementInstanceResults
    type PrismaElementData = ElementData
    type PrismaElementInstanceOptions = ElementInstanceOptions
    type PrismaPeerInstructionRunState = PeerInstructionRunState
    type PrismaPeerInstructionComparison = PeerInstructionComparison
    type PrismaGroupActivityDecisions = GroupActivityDecisions
    type PrismaGroupActivityResults = GroupActivityResults
    type PrismaActivityLogModificationDetails = ActivityLogModificationDetails
    type PrismaAssessmentReportSnapshot = AssessmentReportSnapshot
  }
}
// #endregion
