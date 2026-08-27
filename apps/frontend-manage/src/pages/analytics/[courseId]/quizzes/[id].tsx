import { useQuery } from '@apollo/client'
import { faChartSimple } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  GetCourseActivitiesDocument,
  GetActivityAnalyticsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import AnalyticsAccessGuard from '../../../../components/analytics/AnalyticsAccessGuard'
import useCourseLearningAnalyticsControl from '../../../../components/analytics/useCourseLearningAnalyticsControl'
import ActivityAnalyticsCharts from '../../../../components/analytics/quiz/ActivityAnalyticsCharts'
import InstanceQuizAnalytics from '../../../../components/analytics/quiz/InstanceQuizAnalytics'
import QuizAnalyticsNavigation from '../../../../components/analytics/quiz/QuizAnalyticsNavigation'
import PreviewTag from '../../../../components/common/PreviewTag'
import Layout from '../../../../components/Layout'

function QuizAnalytics() {
  const router = useRouter()
  const t = useTranslations()
  const activityId =
    typeof router.query.id === 'string' ? router.query.id : undefined
  const courseId =
    typeof router.query.courseId === 'string'
      ? router.query.courseId
      : undefined
  const control = useCourseLearningAnalyticsControl(courseId)

  const {
    data: courseActivitiesData,
    loading: courseActivitiesLoading,
    error: courseActivitiesError,
  } = useQuery(GetCourseActivitiesDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId || !control.courseEnabled || !control.analyticsValid,
    fetchPolicy: 'network-only',
  })
  const courseActivities = courseActivitiesData?.getCourseActivities
  const activityBelongsToCourse = courseActivities
    ? courseActivities.id === courseId &&
      [
        ...(courseActivities.practiceQuizzes ?? []),
        ...(courseActivities.microLearnings ?? []),
      ].some((activity) => activity.id === activityId)
    : false

  const { data, loading, error } = useQuery(GetActivityAnalyticsDocument, {
    variables: { activityId: activityId ?? '' },
    skip:
      !activityId ||
      !courseId ||
      !control.courseEnabled ||
      !control.analyticsValid ||
      !activityBelongsToCourse,
    fetchPolicy: 'network-only',
  })

  const navigation =
    courseId && activityId ? (
      <QuizAnalyticsNavigation courseId={courseId} activityId={activityId} />
    ) : undefined
  const analytics = data?.getActivityAnalytics

  const chartColors = {
    correct: '#064e3b',
    partial: '#f59e0b',
    incorrect: '#cc0000',
  }

  return (
    <AnalyticsAccessGuard
      title={t('manage.analytics.quizDashboard')}
      courseId={courseId}
      navigation={navigation}
      control={control}
      loading={loading || courseActivitiesLoading}
      error={error ?? courseActivitiesError}
      hasData={
        activityBelongsToCourse &&
        analytics !== null &&
        typeof analytics !== 'undefined'
      }
    >
      {() =>
        analytics ? (
          <Layout displayName={t('manage.analytics.quizDashboard')}>
            {navigation}
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
              <div className="relative mb-3 flex w-full flex-row items-end justify-between">
                <div className="flex flex-row items-center gap-5">
                  <H1 className={{ root: 'mb-0' }}>
                    {t('manage.analytics.quizAnalytics')}:{' '}
                    {analytics.activityName}
                  </H1>
                  <PreviewTag className="text-base" />
                </div>
                <Button
                  className={{ root: 'h-8' }}
                  onClick={() =>
                    window.open(
                      analytics.activityType === ActivityType.PracticeQuiz
                        ? `${router.locale ? `/${router.locale}` : ''}/practiceQuiz/${activityId}/evaluation`
                        : `${router.locale ? `/${router.locale}` : ''}/microLearning/${activityId}/evaluation`,
                      '_blank'
                    )
                  }
                  data={{ cy: 'activity-evaluation-link' }}
                >
                  <Button.Icon icon={faChartSimple} />
                  <Button.Label>{t('shared.generic.evaluation')}</Button.Label>
                </Button>
              </div>
              <ActivityAnalyticsCharts
                activityName={analytics.activityName}
                activityType={analytics.activityType}
                analytics={analytics.activityQuizAnalytics}
                colors={chartColors}
                className="mb-6 w-full"
              />
              <div className="flex w-full flex-col gap-2">
                {analytics.instanceQuizAnalytics.map((instance, idx) => (
                  <InstanceQuizAnalytics
                    key={instance.id}
                    analytics={instance}
                    colors={chartColors}
                    initiallyOpen={idx === 0}
                    showLegend={idx === 0}
                  />
                ))}
              </div>
            </div>
          </Layout>
        ) : null
      }
    </AnalyticsAccessGuard>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default QuizAnalytics
