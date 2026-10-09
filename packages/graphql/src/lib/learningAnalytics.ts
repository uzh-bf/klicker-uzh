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

/** Optional analytics stay unavailable until consent-aware processing is released. */
export function isLearningAnalyticsEnabled(): boolean {
  return false
}

/**
 * Advance the shared analytics eligibility generation after a
 * learning-analytics choice changes, and mark stored course analytics that
 * were computed under the previous choice set for recomputation.
 *
 * The generation counter is the contract with the analytics service: it
 * captures the counter before reading participant data and revalidates it
 * before publishing. Callers must hold the learning-analytics advisory lock,
 * so a bump cannot slip between another writer's validation and its commit.
 */
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
    data: { areAnalyticsValid: false },
  })
}
