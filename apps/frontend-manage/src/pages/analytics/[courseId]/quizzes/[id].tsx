import { useQuery } from '@apollo/client'
import { faChartSimple } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  GetActivityAnalyticsDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import AnalyticsDisabledView from '../../../../components/analytics/AnalyticsDisabledView'
import AnalyticsErrorView from '../../../../components/analytics/AnalyticsErrorView'
import AnalyticsLoadingView from '../../../../components/analytics/AnalyticsLoadingView'
import ActivityAnalyticsCharts from '../../../../components/analytics/quiz/ActivityAnalyticsCharts'
import InstanceQuizAnalytics from '../../../../components/analytics/quiz/InstanceQuizAnalytics'
import QuizAnalyticsNavigation from '../../../../components/analytics/quiz/QuizAnalyticsNavigation'
import PreviewTag from '../../../../components/common/PreviewTag'
import Layout from '../../../../components/Layout'
import { learningAnalyticsRolloutEnabled } from '../../../../lib/learningAnalytics'

function QuizAnalytics() {
  const router = useRouter()
  const t = useTranslations()
  const activityId = router.query.id as string
  const courseId = router.query.courseId as string

  const { data, loading, error } = useQuery(GetActivityAnalyticsDocument, {
    variables: { activityId },
    skip: !activityId || !learningAnalyticsRolloutEnabled,
  })
  const { data: courseData, loading: courseLoading } = useQuery(
    GetSingleCourseDocument,
    {
      variables: { courseId },
      skip: !courseId || !learningAnalyticsRolloutEnabled,
    }
  )

  const navigation = (
    <QuizAnalyticsNavigation courseId={courseId} activityId={activityId} />
  )
  const analytics = data?.getActivityAnalytics

  const chartColors = {
    correct: '#064e3b',
    partial: '#f59e0b',
    incorrect: '#cc0000',
  }

  // loading state
  if (loading || courseLoading || !activityId || !courseId) {
    return (
      <AnalyticsLoadingView
        title={t('manage.analytics.quizDashboard')}
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
        title={t('manage.analytics.quizDashboard')}
        navigation={navigation}
      />
    )
  }

  // error state
  if (analytics === null || typeof analytics === 'undefined' || error) {
    return (
      <AnalyticsErrorView
        title={t('manage.analytics.quizDashboard')}
        navigation={navigation}
      />
    )
  }

  return (
    <Layout displayName={t('manage.analytics.quizDashboard')}>
      {navigation}
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <div className="relative mb-3 flex w-full flex-row items-end justify-between">
          <div className="flex flex-row items-center gap-5">
            <H1 className={{ root: 'mb-0' }}>
              {t('manage.analytics.quizAnalytics')}: {analytics.activityName}
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
