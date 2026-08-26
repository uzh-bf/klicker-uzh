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
