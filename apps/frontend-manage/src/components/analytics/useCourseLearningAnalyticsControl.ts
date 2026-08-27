import { useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { GetCourseLearningAnalyticsControlDocument } from '@klicker-uzh/graphql/dist/ops'

function useCourseLearningAnalyticsControl(courseId?: string) {
  const globallyEnabled = useFeatureFlag('learning-analytics')
  const { data, loading, error } = useQuery(
    GetCourseLearningAnalyticsControlDocument,
    {
      variables: { courseId: courseId ?? '' },
      skip: !courseId || !globallyEnabled,
    }
  )

  return {
    globallyEnabled,
    loading,
    error,
    exists: Boolean(data?.course),
    courseEnabled: data?.course?.isLearningAnalyticsEnabled === true,
    analyticsValid: data?.course?.analyticsStatus.areAnalyticsValid === true,
  }
}

export default useCourseLearningAnalyticsControl
