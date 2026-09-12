import {
  useFeatureFlag,
  useFeatureFlagEvaluationAvailable,
  useFeatureFlagsReady,
} from '@klicker-uzh/feature-flags/react'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import Layout from '~/components/Layout'
import { useManageFeatureProfileLoading } from './ManageFeatureFlagProvider'

export default function LearningAnalyticsRouteGuard({
  children,
}: {
  children: ReactNode
}) {
  const t = useTranslations()
  const flagsReady = useFeatureFlagsReady()
  const profileLoading = useManageFeatureProfileLoading()
  const flagEvaluationAvailable = useFeatureFlagEvaluationAvailable()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')
  const title = t('shared.generic.learningAnalytics')

  if (profileLoading || !flagsReady) {
    // Resolve profile availability before mounting Layout's login redirect.
    return (
      <div
        role="status"
        className="flex h-full w-full items-center justify-center gap-4 text-lg"
      >
        {t('manage.analytics.analyticsLoadingWait')}
        <Loader basic />
      </div>
    )
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
