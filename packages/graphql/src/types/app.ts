import { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
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
    type PrismaSingleQuestionResponse = SingleQuestionResponse
    type PrismaElementOptions = ElementOptions
    type PrismaElementResults = ElementInstanceResults
    type PrismaElementData = ElementData
    type PrismaElementInstanceOptions = ElementInstanceOptions
    type PrismaGroupActivityDecisions = GroupActivityDecisions
    type PrismaGroupActivityResults = GroupActivityResults
    type PrismaActivityLogModificationDetails = ActivityLogModificationDetails
  }
}
// #endregion
