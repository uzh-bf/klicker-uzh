import type * as DB from '@klicker-uzh/prisma/client'

/**
 * The version identifies the disclosure shown with the current participant
 * choice. It is owned by the server; clients only submit the Boolean choice.
 */
export const PARTICIPANT_DATA_USE_DISCLOSURE_VERSION = 'v1'

/**
 * This gate serializes global learning-analytics choice changes with course
 * writers. The two-key form is shared with the course-level analytics code.
 */
export const LEARNING_ANALYTICS_ADVISORY_LOCK = {
  classId: 1279340545,
  objectId: 0,
} as const

export const learningAnalyticsParticipantWhere = {
  learningAnalyticsConsent: true,
  learningAnalyticsChoiceAt: { not: null },
  // Raw read predicates additionally trim this value. Prisma relation filters
  // cannot compare the trimmed value, but excluding the empty string here
  // keeps the ORM guard aligned for ordinary recorded states.
  learningAnalyticsDisclosureVersion: { not: '' },
  learningAnalyticsIncludedFrom: { not: null },
} satisfies DB.Prisma.ParticipantWhereInput

export type ParticipantDataUseFields = Pick<
  DB.Participant,
  | 'researchConsent'
  | 'researchConsentChoiceAt'
  | 'researchConsentDisclosureVersion'
  | 'learningAnalyticsConsent'
  | 'learningAnalyticsChoiceAt'
  | 'learningAnalyticsDisclosureVersion'
  | 'learningAnalyticsIncludedFrom'
>

export const participantDataUseSelect = {
  researchConsent: true,
  researchConsentChoiceAt: true,
  researchConsentDisclosureVersion: true,
  learningAnalyticsConsent: true,
  learningAnalyticsChoiceAt: true,
  learningAnalyticsDisclosureVersion: true,
  learningAnalyticsIncludedFrom: true,
} satisfies DB.Prisma.ParticipantSelect
