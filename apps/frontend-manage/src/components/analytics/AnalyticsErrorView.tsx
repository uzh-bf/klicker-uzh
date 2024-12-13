import { H1, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import Layout from '~/components/Layout'

function AnalyticsErrorView({
  title,
  navigation,
}: {
  title: string
  navigation: React.ReactNode
}) {
  const t = useTranslations()

  return (
    <Layout displayName={title}>
      {navigation}
      <H1>{title}</H1>
      <UserNotification
        message={t('manage.analytics.analyticsLoadingFailed')}
        type="error"
        className={{ root: 'mx-auto my-auto w-max max-w-full text-base' }}
      />
    </Layout>
  )
}

export default AnalyticsErrorView
