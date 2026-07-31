import type { LearningAnalyticsParticipationStatus } from '@klicker-uzh/prisma/client'

interface LearningAnalyticsEligibility {
  isCourseEnabled: boolean
  participationStatus: LearningAnalyticsParticipationStatus
  acknowledgedDisclosureVersion: string | null
  currentDisclosureVersion: string
  includedFrom: Date | null
  activityAt: Date
}

export function isActivityEligibleForLearningAnalytics(
  eligibility: LearningAnalyticsEligibility
): boolean {
  const {
    isCourseEnabled,
    participationStatus,
    acknowledgedDisclosureVersion,
    currentDisclosureVersion,
    includedFrom,
    activityAt,
  } = eligibility

  return (
    isCourseEnabled &&
    participationStatus === 'INCLUDED' &&
    currentDisclosureVersion.length > 0 &&
    acknowledgedDisclosureVersion === currentDisclosureVersion &&
    includedFrom !== null &&
    activityAt.getTime() >= includedFrom.getTime()
  )
}
