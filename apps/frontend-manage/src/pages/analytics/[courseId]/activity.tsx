import { useQuery } from '@apollo/client'
import {
  GetCourseActivityAnalyticsDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityAnalyticsNavigation from '../../../components/analytics/activity/ActivityAnalyticsNavigation'
import DailyActivityPlot from '../../../components/analytics/activity/DailyActivityPlot'
import DailyActivityTimeSeries from '../../../components/analytics/activity/DailyActivityTimeSeries'
import TotalStudentActivityPlot from '../../../components/analytics/activity/TotalStudentActivityPlot'
import WeeklyActivityTimeSeries from '../../../components/analytics/activity/WeeklyActivityTimeSeries'
import AnalyticsDisabledView from '../../../components/analytics/AnalyticsDisabledView'
import AnalyticsErrorView from '../../../components/analytics/AnalyticsErrorView'
import AnalyticsLoadingView from '../../../components/analytics/AnalyticsLoadingView'
import PreviewTag from '../../../components/common/PreviewTag'
import Layout from '../../../components/Layout'
import { learningAnalyticsRolloutEnabled } from '../../../lib/learningAnalytics'

function ActivityDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId

  const { data, loading, error } = useQuery(
    GetCourseActivityAnalyticsDocument,
    {
      variables: { courseId: courseId as string },
      skip: !courseId || !learningAnalyticsRolloutEnabled,
    }
  )
  const { data: courseData, loading: courseLoading } = useQuery(
    GetSingleCourseDocument,
    {
      variables: { courseId: courseId as string },
      skip: !courseId || !learningAnalyticsRolloutEnabled,
    }
  )
  const course = data?.getCourseActivityAnalytics
  const navigation = (
    <ActivityAnalyticsNavigation courseId={courseId as string} />
  )

  // loading state
  if (loading || courseLoading || !courseId) {
    return (
      <AnalyticsLoadingView
        title={t('manage.analytics.activityDashboard')}
        navigation={navigation}
      />
    )
  }

  if (
    !learningAnalyticsRolloutEnabled ||
    courseData?.course?.isLearningAnalyticsEnabled === false
  ) {
    return (
      <AnalyticsDisabledView
        title={t('manage.analytics.activityDashboard')}
        navigation={navigation}
      />
    )
  }

  // error state
  if (course === null || typeof course === 'undefined' || error) {
    return (
      <AnalyticsErrorView
        title={t('manage.analytics.activityDashboard')}
        navigation={navigation}
      />
    )
  }

  return (
    <Layout displayName={t('manage.analytics.activityDashboard')}>
      {navigation}
      <div className="mb-3 flex w-full flex-row items-end justify-between font-bold">
        <div className="flex flex-row items-center gap-5">
          <H1 className={{ root: 'mb-0' }}>
            {t('manage.analytics.activityDashboard')}: {course.name}
          </H1>
          <PreviewTag className="text-base" />
        </div>
        <div>
          {t('manage.analytics.totalParticipants', {
            number: course.totalParticipants,
          })}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <WeeklyActivityTimeSeries
          activity={course.weeklyActivity}
          courseName={course.name}
          courseParticipants={course.totalParticipants}
        />
        <div className="flex w-full flex-col gap-3 lg:flex-row">
          <div className="w-full lg:w-2/3">
            <DailyActivityTimeSeries
              activity={course.dailyActivity}
              courseParticipants={course.totalParticipants}
            />
          </div>
          <div className="w-full lg:w-1/3">
            <DailyActivityPlot
              courseParticipants={course.totalParticipants}
              activeDays={course.activeDays}
            />
          </div>
        </div>
        <TotalStudentActivityPlot
          courseName={course.name}
          courseWeeks={course.courseWeeks}
          participantActivity={course.participantCourseAnalytics}
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
