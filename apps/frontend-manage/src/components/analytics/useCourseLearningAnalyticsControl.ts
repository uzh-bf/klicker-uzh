import { NetworkStatus, useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { GetCourseLearningAnalyticsControlDocument } from '@klicker-uzh/graphql/dist/ops'
import type { ApolloError } from '@apollo/client'
import { useEffect, useRef } from 'react'

export type CourseLearningAnalyticsControl = {
  globallyEnabled: boolean
  loading: boolean
  error?: ApolloError
  exists: boolean
  courseEnabled: boolean
  analyticsValid: boolean
}

function useCourseLearningAnalyticsControl(
  courseId?: string
): CourseLearningAnalyticsControl {
  const globallyEnabled = useFeatureFlag('learning-analytics')
  const { data, loading, error, networkStatus, refetch } = useQuery(
    GetCourseLearningAnalyticsControlDocument,
    {
      variables: { courseId: courseId ?? '' },
      skip: !courseId || !globallyEnabled,
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    }
  )
  const refetchInFlight = useRef(false)

  useEffect(() => {
    if (!courseId || !globallyEnabled) return

    const refresh = () => {
      if (document.visibilityState !== 'visible' || refetchInFlight.current) {
        return
      }

      refetchInFlight.current = true
      void refetch()
        .catch(() => undefined)
        .finally(() => {
          refetchInFlight.current = false
        })
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [courseId, globallyEnabled, refetch])

  return {
    globallyEnabled,
    loading: loading || networkStatus === NetworkStatus.refetch,
    error,
    exists: Boolean(data?.course),
    courseEnabled: data?.course?.isLearningAnalyticsEnabled === true,
    analyticsValid: data?.course?.analyticsStatus.areAnalyticsValid === true,
  }
}

export default useCourseLearningAnalyticsControl
