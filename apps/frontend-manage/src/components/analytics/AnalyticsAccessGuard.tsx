import type { ApolloError } from '@apollo/client'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import AnalyticsErrorView from './AnalyticsErrorView'
import AnalyticsLoadingView from './AnalyticsLoadingView'
import AnalyticsUnavailableView from './AnalyticsUnavailableView'
import type { CourseLearningAnalyticsControl } from './useCourseLearningAnalyticsControl'

type AnalyticsAccessGuardProps<TData> = {
  title: string
  courseId?: string
  navigation?: ReactNode
  control: CourseLearningAnalyticsControl
  loading: boolean
  error?: ApolloError
  data: TData
  children: (data: NonNullable<TData>) => ReactNode
}

function AnalyticsAccessGuard<TData>({
  title,
  courseId,
  navigation,
  control,
  loading,
  error,
  data,
  children,
}: AnalyticsAccessGuardProps<TData>) {
  const t = useTranslations()

  if (!control.globallyEnabled) {
    return (
      <AnalyticsUnavailableView
        title={title}
        message={t('manage.analytics.featureUnavailable')}
      />
    )
  }

  if (control.entitlementLoading) {
    return <AnalyticsLoadingView title={title} navigation={undefined} />
  }

  if (control.error) {
    return (
      <AnalyticsUnavailableView
        title={title}
        message={t('manage.analytics.statusUnavailable')}
        type="error"
      />
    )
  }

  if (!control.catalystEntitled) {
    return (
      <AnalyticsUnavailableView
        title={title}
        message={t('manage.analytics.catalystRequired')}
      />
    )
  }

  if (control.loading || !courseId) {
    return <AnalyticsLoadingView title={title} navigation={undefined} />
  }

  if (!control.exists) {
    return (
      <AnalyticsUnavailableView
        title={title}
        navigation={navigation}
        message={t('manage.analytics.statusUnavailable')}
        type="error"
      />
    )
  }

  if (control.courseArchived) {
    return (
      <AnalyticsUnavailableView
        title={title}
        navigation={navigation}
        message={t('manage.analytics.courseArchived')}
      />
    )
  }

  if (!control.courseEnabled) {
    return (
      <AnalyticsUnavailableView
        title={title}
        navigation={navigation}
        message={t('manage.analytics.courseDisabled')}
      />
    )
  }

  if (!control.analyticsValid) {
    return (
      <AnalyticsUnavailableView
        title={title}
        navigation={navigation}
        message={t('manage.analytics.recomputationPending')}
      />
    )
  }

  if (loading) {
    return <AnalyticsLoadingView title={title} navigation={navigation} />
  }

  if (error || data == null) {
    return <AnalyticsErrorView title={title} navigation={navigation} />
  }

  return <>{children(data)}</>
}

export default AnalyticsAccessGuard
