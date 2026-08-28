import { NetworkStatus, useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  GetCourseLearningAnalyticsControlDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import type { ApolloError } from '@apollo/client'
import { useEffect, useRef } from 'react'

export type CourseLearningAnalyticsControl = {
  globallyEnabled: boolean
  catalystEntitled: boolean
  entitlementLoading: boolean
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
  const {
    data: userData,
    loading: entitlementLoading,
    error: entitlementError,
  } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const catalystEntitled = userData?.userProfile?.catalyst === true
  const hasAccess = globallyEnabled && catalystEntitled
  const { data, loading, error, networkStatus, refetch } = useQuery(
    GetCourseLearningAnalyticsControlDocument,
    {
      variables: { courseId: courseId ?? '' },
      skip: !courseId || !hasAccess,
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    }
  )
  const refetchInFlight = useRef(false)

  useEffect(() => {
    if (!courseId || !hasAccess) return

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
  }, [courseId, hasAccess, refetch])

  return {
    globallyEnabled,
    catalystEntitled,
    entitlementLoading,
    loading: loading || networkStatus === NetworkStatus.refetch,
    error: entitlementError ?? error,
    exists: Boolean(data?.course),
    courseEnabled: data?.course?.isLearningAnalyticsEnabled === true,
    analyticsValid: data?.course?.analyticsStatus.areAnalyticsValid === true,
  }
}

export default useCourseLearningAnalyticsControl
