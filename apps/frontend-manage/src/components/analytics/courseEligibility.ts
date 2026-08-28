import type { Course } from '@klicker-uzh/graphql/dist/ops'

export type LearningAnalyticsCourse = Pick<
  Course,
  'isArchived' | 'isLearningAnalyticsEnabled' | 'analyticsStatus'
>

export function isCourseLearningAnalyticsAvailable(
  course: LearningAnalyticsCourse | null | undefined
) {
  return (
    course?.isArchived === false &&
    course.isLearningAnalyticsEnabled === true &&
    course.analyticsStatus.areAnalyticsValid === true
  )
}
