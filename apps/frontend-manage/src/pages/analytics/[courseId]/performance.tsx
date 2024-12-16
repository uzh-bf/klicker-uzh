import { useQuery } from '@apollo/client'
import { GetCoursePerformanceAnalyticsDocument } from '@klicker-uzh/graphql/dist/ops'
import { H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import AnalyticsErrorView from '~/components/analytics/AnalyticsErrorView'
import AnalyticsLoadingView from '~/components/analytics/AnalyticsLoadingView'
import ActivityProgressPlot from '~/components/analytics/performance/ActivityProgressPlot'
import PerformanceAnalyticsNavigation from '~/components/analytics/performance/PerformanceAnalyticsNavigation'
import PerformanceRates from '~/components/analytics/performance/PerformanceRates'
import Layout from '~/components/Layout'

function PerformanceDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId as string

  const { data, loading, error } = useQuery(
    GetCoursePerformanceAnalyticsDocument,
    { variables: { courseId }, skip: !courseId }
  )

  const navigation = <PerformanceAnalyticsNavigation courseId={courseId} />
  const course = data?.getCoursePerformanceAnalytics

  // loading state
  if (loading || !courseId) {
    return (
      <AnalyticsLoadingView
        title={t('manage.analytics.performanceDashboard')}
        navigation={navigation}
      />
    )
  }

  // error state
  if (course === null || typeof course === 'undefined' || error) {
    return (
      <AnalyticsErrorView
        title={t('manage.analytics.performanceDashboard')}
        navigation={navigation}
      />
    )
  }

  return (
    <Layout displayName={t('manage.analytics.performanceDashboard')}>
      {navigation}
      <div>
        <div className="mb-3 flex w-full flex-row items-end justify-between font-bold">
          <H1 className={{ root: 'mb-0' }}>
            {t('manage.analytics.performanceDashboard')}: {course.name}
          </H1>
          <div>
            {t('manage.analytics.totalParticipants', {
              number: course.totalParticipants,
            })}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <PerformanceRates
            activityPerformances={course.activityPerformances}
            instancePerformances={course.instancePerformances}
          />
          <ActivityProgressPlot
            activityProgresses={course.activityProgresses}
            participants={course.totalParticipants}
          />
        </div>
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
