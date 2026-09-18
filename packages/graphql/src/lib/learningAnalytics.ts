import type * as DB from '@klicker-uzh/prisma/client'

export { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util'

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
>

export const participantDataUseSelect = {
  researchConsent: true,
  researchConsentChoiceAt: true,
  researchConsentDisclosureVersion: true,
  learningAnalyticsConsent: true,
  learningAnalyticsChoiceAt: true,
  learningAnalyticsDisclosureVersion: true,
} satisfies DB.Prisma.ParticipantSelect

/** Invalidate in-flight calculations while holding the shared eligibility gate. */
export async function invalidateAnalyticsEligibility(
  prisma: DB.Prisma.TransactionClient
) {
  await prisma.analyticsEligibilityGeneration.upsert({
    where: { id: 0 },
    create: { id: 0, generation: 1 },
    update: { generation: { increment: 1 } },
  })
  await prisma.course.updateMany({
    where: { areAnalyticsValid: true },
    data: { areAnalyticsValid: false, analyticsLastComputedAt: null },
  })
}
