import { H1, H3 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityDashboardLabel from '~/components/analytics/overview/ActivityDashboardLabel'
import AnalyticsNavigation from '~/components/analytics/overview/AnalyticsNavigation'
import QuizDashboardLabel from '~/components/analytics/overview/QuizDashboardLabel'
import Layout from '~/components/Layout'

function PerformanceDashboard() {
  const t = useTranslations()
  const router = useRouter()

  return (
    <Layout displayName={t('manage.analytics.performanceDashboard')}>
      <AnalyticsNavigation
        hrefLeft={`/analytics/${router.query.courseId}/activity`}
        labelLeft={<ActivityDashboardLabel />}
        hrefRight={`/analytics/${router.query.courseId}/quizzes`}
        labelRight={<QuizDashboardLabel />}
      />
      <div>
        <H1>{t('manage.analytics.performanceDashboard')}</H1>
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

export default PerformanceDashboard
