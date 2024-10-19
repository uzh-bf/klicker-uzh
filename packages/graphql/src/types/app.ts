import { Prisma, PrismaClient } from '@klicker-uzh/prisma'
import type {
  AllElementTypeData,
  AllQuestionTypeData,
  AvatarSettings,
  ElementInstanceOptions,
  ElementInstanceResults,
  ElementOptions,
  ElementStackOptions,
  GroupActivityDecisions,
  GroupActivityResults,
  QuestionResponse,
  QuestionResults,
} from '@klicker-uzh/types'

export type PrismaMigrationClient = Omit<
  PrismaClient<Prisma.PrismaClientOptions, never>,
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
    type PrismaQuestionResponse = QuestionResponse
    type PrismaElementOptions = ElementOptions
    type PrismaElementResults = ElementInstanceResults
    type PrismaQuestionResults = QuestionResults
    type PrismaElementData = AllElementTypeData
    type PrismaQuestionData = AllQuestionTypeData // TODO: remove after migration of live quiz
    type PrismaElementInstanceOptions = ElementInstanceOptions
    type PrismaGroupActivityDecisions = GroupActivityDecisions
    type PrismaGroupActivityResults = GroupActivityResults
  }
}
// #endregion

// ----- ELEMENT STACKS -----
// #region
declare global {
  namespace PrismaJson {
    type PrismaElementStackOptions = ElementStackOptions
  }
}
// #endregion
