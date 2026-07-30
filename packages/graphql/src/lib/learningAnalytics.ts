import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export const LEARNING_ANALYTICS_DISCLOSURE_VERSION = '2026-07-30-v1'

export type LearningAnalyticsChoiceStatus =
  | typeof DB.LearningAnalyticsParticipationStatus.INCLUDED
  | typeof DB.LearningAnalyticsParticipationStatus.EXCLUDED

export function isLearningAnalyticsRolloutEnabled() {
  return process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED === 'true'
}

export function assertLearningAnalyticsRolloutEnabled() {
  if (!isLearningAnalyticsRolloutEnabled()) {
    throw new GraphQLError('LEARNING_ANALYTICS_NOT_AVAILABLE', {
      extensions: { code: 'LEARNING_ANALYTICS_NOT_AVAILABLE' },
    })
  }
}

export function assertLearningAnalyticsChoiceAvailable(
  isCourseEnabled: boolean
) {
  assertLearningAnalyticsRolloutEnabled()

  if (!isCourseEnabled) {
    throw new GraphQLError('LEARNING_ANALYTICS_NOT_ENABLED_FOR_COURSE', {
      extensions: { code: 'LEARNING_ANALYTICS_NOT_ENABLED_FOR_COURSE' },
    })
  }
}

export function isLearningAnalyticsAvailableForCourse(
  isCourseEnabled: boolean
) {
  return isLearningAnalyticsRolloutEnabled() && isCourseEnabled
}

export function assertLearningAnalyticsChoiceProvided(
  isCourseEnabled: boolean,
  status?: LearningAnalyticsChoiceStatus | null
) {
  if (
    isLearningAnalyticsAvailableForCourse(isCourseEnabled) &&
    (typeof status === 'undefined' || status === null)
  ) {
    throw new GraphQLError('LEARNING_ANALYTICS_CHOICE_REQUIRED', {
      extensions: { code: 'LEARNING_ANALYTICS_CHOICE_REQUIRED' },
    })
  }
}

export function buildLearningAnalyticsChoiceData(
  status: LearningAnalyticsChoiceStatus,
  choiceAt = new Date()
) {
  const includedFrom =
    status === DB.LearningAnalyticsParticipationStatus.INCLUDED
      ? choiceAt
      : null

  return {
    learningAnalyticsStatus: status,
    learningAnalyticsIncludedFrom: includedFrom,
    learningAnalyticsChoiceAt: choiceAt,
    learningAnalyticsDisclosureVersion: LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    learningAnalyticsChoiceEvents: {
      create: {
        status,
        includedFrom,
        disclosureVersion: LEARNING_ANALYTICS_DISCLOSURE_VERSION,
      },
    },
  }
}

export function isLearningAnalyticsChoiceCurrent({
  learningAnalyticsStatus,
  learningAnalyticsDisclosureVersion,
}: Pick<
  DB.Participation,
  'learningAnalyticsStatus' | 'learningAnalyticsDisclosureVersion'
>) {
  return (
    learningAnalyticsStatus !==
      DB.LearningAnalyticsParticipationStatus.UNDECIDED &&
    learningAnalyticsDisclosureVersion === LEARNING_ANALYTICS_DISCLOSURE_VERSION
  )
}

export function learningAnalyticsParticipationWhere(courseId?: string) {
  return {
    ...(courseId ? { courseId } : {}),
    learningAnalyticsStatus: DB.LearningAnalyticsParticipationStatus.INCLUDED,
    learningAnalyticsDisclosureVersion: LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    learningAnalyticsIncludedFrom: { not: null },
  } satisfies DB.Prisma.ParticipationWhereInput
}
