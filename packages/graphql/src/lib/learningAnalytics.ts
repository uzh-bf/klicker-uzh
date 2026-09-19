import type * as DB from '@klicker-uzh/prisma/client'

export { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util'

/**
 * This gate serializes global learning-analytics choice changes. Today the
 * consent mutations in participantAccountDataUse.ts are the only acquisition
 * sites of this key pair; course-level analytics writers do not exist yet and
 * must acquire the identical key pair for serialization against these choices
 * to hold (Postgres advisory locks conflict only on identical keys).
 */
export const LEARNING_ANALYTICS_ADVISORY_LOCK = {
  classId: 1279340545,
  objectId: 0,
} as const

export type ParticipantDataUseFields = Pick<
  DB.Participant,
  | 'researchConsent'
  | 'researchConsentChoiceAt'
  | 'researchConsentDisclosureVersion'
  | 'learningAnalyticsConsent'
  | 'learningAnalyticsChoiceAt'
  | 'learningAnalyticsDisclosureVersion'
>

export const participantDataUseSelect = {
  researchConsent: true,
  researchConsentChoiceAt: true,
  researchConsentDisclosureVersion: true,
  learningAnalyticsConsent: true,
  learningAnalyticsChoiceAt: true,
  learningAnalyticsDisclosureVersion: true,
} satisfies DB.Prisma.ParticipantSelect
