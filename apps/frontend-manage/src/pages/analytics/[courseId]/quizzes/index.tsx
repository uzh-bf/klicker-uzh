import { useQuery } from '@apollo/client'
import {
  GetCourseActivitiesDocument,
  MicroLearning,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H1,
  H3,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import * as JsSearch from 'js-search'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import AnalyticsAccessGuard from '../../../../components/analytics/AnalyticsAccessGuard'
import useCourseLearningAnalyticsControl from '../../../../components/analytics/useCourseLearningAnalyticsControl'
import QuizSelectionNavigation from '../../../../components/analytics/quiz/QuizSelectionNavigation'
import PreviewTag from '../../../../components/common/PreviewTag'
import Layout from '../../../../components/Layout'

const ActivityLink = ({
  courseId,
  activityId,
  activityName,
}: {
  courseId: string
  activityId: string
  activityName: string
}) => (
  <Link
    key={`analytics-link-pq-${activityId}`}
    href={`/analytics/${courseId}/quizzes/${activityId}`}
  >
    <Button className={{ root: 'h-9 w-full' }}>{activityName}</Button>
  </Link>
)

function ActivityDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId =
    typeof router.query.courseId === 'string'
      ? router.query.courseId
      : undefined
  const control = useCourseLearningAnalyticsControl(courseId)
  const [practiceSearch, setPracticeSearch] = useState('')
  const [microSearch, setMicroSearch] = useState('')

  const { data, loading, error } = useQuery(GetCourseActivitiesDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId || !control.courseEnabled || !control.analyticsValid,
    fetchPolicy: 'network-only',
  })

  const navigation = courseId ? (
    <QuizSelectionNavigation courseId={courseId} />
  ) : undefined
  const course = data?.getCourseActivities

  const practiceSearchEngine = useMemo(() => {
    const search = new JsSearch.Search('id')
    search.addIndex('name')
    if (course?.practiceQuizzes) {
      search.addDocuments(course.practiceQuizzes)
    }
    return search
  }, [course?.practiceQuizzes])

  const microSearchEngine = useMemo(() => {
    const search = new JsSearch.Search('id')
    search.addIndex('name')
    if (course?.microLearnings) {
      search.addDocuments(course.microLearnings)
    }
    return search
  }, [course?.microLearnings])

  const filteredPracticeQuizzes = useMemo(() => {
    if (!practiceSearch) return course?.practiceQuizzes
    return practiceSearchEngine.search(practiceSearch) as PracticeQuiz[]
  }, [practiceSearch, course?.practiceQuizzes, practiceSearchEngine])

  const filteredMicroLearnings = useMemo(() => {
    if (!microSearch) return course?.microLearnings
    return microSearchEngine.search(microSearch) as MicroLearning[]
  }, [microSearch, course?.microLearnings, microSearchEngine])

  return (
    <AnalyticsAccessGuard
      title={t('manage.analytics.quizDashboard')}
      courseId={courseId}
      navigation={navigation}
      control={control}
      loading={loading}
      error={error}
      data={course}
    >
      {(course) => {
        if (!courseId) return null

        return (
          <Layout displayName={t('manage.analytics.quizDashboard')}>
            {navigation}
            <div>
              <div className="mb-3 flex w-full flex-row items-end justify-between font-bold">
                <div className="flex flex-row items-center gap-5">
                  <H1 className={{ root: 'mb-0' }}>
                    {t('manage.analytics.quizAnalytics')}: {course.name}
                  </H1>
                  <PreviewTag className="text-base" />
                </div>
              </div>
              <div>{t('manage.analytics.selectActivityAnalytics')}</div>
              <div className="mt-8 flex h-max flex-row">
                <div className="flex h-full w-1/2 flex-col items-center border-r-2 border-solid border-gray-400 pr-4">
                  <H3>{t('shared.generic.practiceQuizzes')}</H3>
                  <TextField
                    placeholder={t('manage.analytics.searchPracticeQuizzes')}
                    className={{ input: 'my-2 h-8' }}
                    value={practiceSearch}
                    onChange={(newValue) => setPracticeSearch(newValue)}
                  />
                  {!course.practiceQuizzes ||
                  course.practiceQuizzes.length === 0 ? (
                    <UserNotification
                      type="info"
                      message={t('manage.analytics.noPracticeQuizzes')}
                      className={{ root: 'w-full' }}
                    />
                  ) : (
                    <div className="grid w-full grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                      {filteredPracticeQuizzes?.map((quiz) => (
                        <ActivityLink
                          key={quiz.id}
                          courseId={courseId}
                          activityId={quiz.id}
                          activityName={quiz.name}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex h-full w-1/2 flex-col items-center pl-4">
                  <H3>{t('shared.generic.microlearnings')}</H3>
                  <TextField
                    placeholder={t('manage.analytics.searchMicroLearnings')}
                    className={{ input: 'my-2 h-8' }}
                    value={microSearch}
                    onChange={(newValue) => setMicroSearch(newValue)}
                  />
                  {!course.microLearnings ||
                  course.microLearnings.length === 0 ? (
                    <UserNotification
                      type="info"
                      message={t('manage.analytics.noMicroLearnings')}
                      className={{ root: 'w-full' }}
                    />
                  ) : (
                    <div className="grid w-full grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                      {filteredMicroLearnings?.map((micro) => (
                        <ActivityLink
                          key={micro.id}
                          courseId={courseId}
                          activityId={micro.id}
                          activityName={micro.name}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Layout>
        )
      }}
    </AnalyticsAccessGuard>
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
