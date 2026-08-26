import {
  useFeatureFlag,
  useFeatureFlagEvaluationAvailable,
  useFeatureFlagsReady,
} from '@klicker-uzh/feature-flags/react'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import AnalyticsLoadingView from '~/components/analytics/AnalyticsLoadingView'
import Layout from '~/components/Layout'

export default function LearningAnalyticsRouteGuard({
  children,
}: {
  children: ReactNode
}) {
  const t = useTranslations()
  const flagsReady = useFeatureFlagsReady()
  const flagEvaluationAvailable = useFeatureFlagEvaluationAvailable()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')
  const title = t('shared.generic.learningAnalytics')

  if (!flagsReady) {
    return <AnalyticsLoadingView title={title} navigation={null} />
  }

  const unavailable = (
    <div
      className="flex h-full w-full items-center justify-center"
      data-cy="learning-analytics-access-denied"
    >
      <UserNotification
        type="info"
        message={t('manage.analytics.featureUnavailable')}
        className={{ root: 'w-max max-w-full text-base' }}
      />
    </div>
  )

  if (!flagEvaluationAvailable) {
    return unavailable
  }

  if (!learningAnalyticsEnabled) {
    return <Layout displayName={title}>{unavailable}</Layout>
  }

  return children
}
