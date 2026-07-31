import type { LearningAnalyticsParticipationStatus } from '@klicker-uzh/prisma/client'

// Single source of truth for the participant disclosure version. Bumping it
// invalidates every existing choice and re-prompts participants. Mirrored in
// apps/analytics/src/modules/learning_analytics_eligibility.py; keep both in
// sync.
export const LEARNING_ANALYTICS_DISCLOSURE_VERSION = '2026-07-30-v1'

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
