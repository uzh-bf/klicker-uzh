import type { Course } from '@klicker-uzh/graphql/dist/ops'

export type LearningAnalyticsCourse = Pick<
  Course,
  'isLearningAnalyticsEnabled' | 'analyticsStatus'
>

export function isCourseLearningAnalyticsAvailable(
  course: LearningAnalyticsCourse | null | undefined
) {
  return (
    course?.isLearningAnalyticsEnabled === true &&
    course.analyticsStatus.areAnalyticsValid === true
  )
}
