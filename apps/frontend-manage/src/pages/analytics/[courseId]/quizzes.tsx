import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import AnalyticsErrorView from '../../../components/analytics/AnalyticsErrorView'
import AnalyticsLoadingView from '../../../components/analytics/AnalyticsLoadingView'
import QuizAnalyticsNavigation from '../../../components/analytics/quiz/QuizAnalyticsNavigation'
import Layout from '../../../components/Layout'

function QuizDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId as string

  // const { data, loading, error } = useQuery(GetCourseQuizAnalyticsDocument, {
  //   variables: { courseId },
  //   skip: !courseId,
  // })
  const data = null
  const loading = false
  const error = false
  const course = null

  const navigation = <QuizAnalyticsNavigation courseId={courseId} />
  // const course = data?.getCourseQuizAnalytics

  // loading state
  if (loading || !courseId) {
    return (
      <AnalyticsLoadingView
        title={t('manage.analytics.quizDashboard')}
        navigation={navigation}
      />
    )
  }

  // error state
  if (course === null || typeof course === 'undefined' || error) {
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
      <div>
        <div className="mb-3 flex w-full flex-row items-end justify-between font-bold">
          {/* <H1 className={{ root: 'mb-0' }}>
            {t('manage.analytics.quizDashboard')}: {course.name}
          </H1> */}
          {/* <div>
            {t('manage.analytics.totalParticipants', {
              number: course.totalParticipants,
            })}
          </div> */}
        </div>
        <div className="flex flex-col gap-4">QUIZ ANALYTICS</div>
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
