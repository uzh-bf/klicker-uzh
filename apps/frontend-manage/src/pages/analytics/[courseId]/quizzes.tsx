import { H1, H3 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityDashboardLabel from '~/components/analytics/overview/ActivityDashboardLabel'
import AnalyticsNavigation from '~/components/analytics/overview/AnalyticsNavigation'
import PerformanceDashboardLabel from '~/components/analytics/overview/PerformanceDashboardLabel'
import Layout from '~/components/Layout'

function QuizDashboard() {
  const t = useTranslations()
  const router = useRouter()

  return (
    <Layout displayName={t('manage.analytics.quizDashboard')}>
      <AnalyticsNavigation
        hrefLeft={`/analytics/${router.query.courseId}/performance`}
        labelLeft={<PerformanceDashboardLabel />}
        hrefRight={`/analytics/${router.query.courseId}/activity`}
        labelRight={<ActivityDashboardLabel />}
      />
      <div>
        <H1>{t('manage.analytics.quizDashboard')}</H1>
        <H3>Coursename Placeholder</H3>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default QuizDashboard
