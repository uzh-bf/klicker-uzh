import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useTranslations } from 'next-intl'
import Layout from '../Layout'

function AnalyticsLoadingView({
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
      <div className="flex h-full w-full flex-row items-center justify-center gap-4 text-lg">
        {t('manage.analytics.analyticsLoadingWait')}
        <Loader basic />
      </div>
    </Layout>
  )
}

export default AnalyticsLoadingView
