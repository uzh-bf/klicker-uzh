import {
  useFeatureFlag,
  useFeatureFlagsReady,
} from '@klicker-uzh/feature-flags/react'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import AnalyticsLoadingView from '../analytics/AnalyticsLoadingView'
import Layout from '../Layout'

export default function LearningAnalyticsRouteGuard({
  children,
}: {
  children: ReactNode
}) {
  const t = useTranslations()
  const flagsReady = useFeatureFlagsReady()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')
  const title = t('shared.generic.learningAnalytics')

  if (!flagsReady) {
    return <AnalyticsLoadingView title={title} navigation={null} />
  }

  if (!learningAnalyticsEnabled) {
    return (
      <Layout displayName={title}>
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
      </Layout>
    )
  }

  return children
}
