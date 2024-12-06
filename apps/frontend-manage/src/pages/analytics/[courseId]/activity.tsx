import { useQuery } from '@apollo/client'
import { GetCourseActivityAnalyticsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityAnalyticsNavigation from '~/components/analytics/activity/ActivityAnalyticsNavigation'
import ActivityTimeSeriesPlot from '~/components/analytics/activity/ActivityTimeSeriesPlot'
import Layout from '~/components/Layout'

function ActivityDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId

  const { data, loading } = useQuery(GetCourseActivityAnalyticsDocument, {
    variables: { courseId: courseId as string },
    skip: !courseId,
  })
  const course = data?.getCourseActivityAnalytics

  // TODO: extract to separate component with variable names / navigation
  // loading state
  if (loading || !courseId) {
    return (
      <Layout displayName={t('manage.analytics.activityDashboard')}>
        <ActivityAnalyticsNavigation courseId={courseId as string} />
        <div className="flex h-full w-full flex-row items-center justify-center gap-4 text-lg">
          {t('manage.analytics.analyticsLoadingWait')}
          <Loader basic />
        </div>
      </Layout>
    )
  }

  // TODO: extract to separate component for re-use
  // error state
  if (course === null || typeof course === 'undefined') {
    return (
      <Layout displayName={t('manage.analytics.activityDashboard')}>
        <ActivityAnalyticsNavigation courseId={courseId as string} />
        <H1>{t('manage.analytics.activityDashboard')}</H1>
        <UserNotification
          message={t('manage.analytics.analyticsLoadingFailed')}
          type="error"
          className={{ root: 'mx-auto my-auto w-max max-w-full text-base' }}
        />
      </Layout>
    )
  }

  return (
    <Layout displayName={t('manage.analytics.activityDashboard')}>
      <ActivityAnalyticsNavigation courseId={courseId as string} />
      <div className="mb-4 flex w-full flex-row items-end justify-between font-bold">
        <H1>
          {t('manage.analytics.activityDashboard')}: {course.name}
        </H1>
        <div>
          {t('manage.analytics.totalParticipants', {
            number: course.totalParticipants,
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <ActivityTimeSeriesPlot
          activity={course.weeklyActivity}
          title={t('manage.analytics.weeklyStudentActivity')}
          courseParticipants={course.totalParticipants}
        />
        <ActivityTimeSeriesPlot
          activity={course.dailyActivity}
          title={t('manage.analytics.dailyStudentActivity')}
          courseParticipants={course.totalParticipants}
        />
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

export default ActivityDashboard
