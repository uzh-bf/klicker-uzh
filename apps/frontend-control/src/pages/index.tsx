import { useQuery } from '@apollo/client'
import {
  GetControlCourseOverviewDocument,
  GetUnassignedControlLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ListRow from '../components/common/ListRow'
import { cardClass } from '../components/common/styles'
import Layout from '../components/Layout'
import HomeHeader from '../components/layout/HomeHeader'
import RunningQuizBanner from '../components/liveQuizzes/RunningQuizBanner'

// quizzes the controller can still act on (start or control); matches the
// running + planned lists on the course page
const CONTROLLABLE = [
  PublicationStatus.Draft,
  PublicationStatus.Scheduled,
  PublicationStatus.Published,
]

function countControllable(quizzes?: { status: PublicationStatus }[] | null) {
  return quizzes?.filter((quiz) => CONTROLLABLE.includes(quiz.status)).length
}

function Index() {
  const t = useTranslations()
  // quizzes are started and ended on other screens, so revalidate on every
  // visit instead of showing a stale running banner or stale counts
  const { loading, data } = useQuery(GetControlCourseOverviewDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const { data: runningData } = useQuery(GetUserRunningLiveQuizzesDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const { data: unassignedData } = useQuery(
    GetUnassignedControlLiveQuizzesDocument,
    {
      fetchPolicy: 'cache-and-network',
    }
  )

  const title = t('control.home.courseSelection')
  const header = <HomeHeader />

  if (loading && !data) {
    return (
      <Layout title={title} header={header}>
        <Loader />
      </Layout>
    )
  }

  // a failed background refetch keeps the cached overview visible
  if (!data) {
    return (
      <Layout title={title} header={header}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.home.errorLoadingCourse')}
        />
      </Layout>
    )
  }

  // archived courses go last; the reversed API order matches the order the
  // previous controller displayed
  const courses = [...(data.controlCourses ?? [])]
    .reverse()
    .sort((a, b) => Number(a.isArchived) - Number(b.isArchived))

  const unassignedCount = countControllable(
    unassignedData?.unassignedLiveQuizzes
  )

  return (
    <Layout title={title} header={header}>
      {runningData?.userRunningLiveQuizzes?.map((quiz) => (
        <RunningQuizBanner key={quiz.id} quiz={quiz} />
      ))}

      <h1 className="text-ctrl-ink text-xl font-bold">
        {t('control.home.chooseCourse')}
      </h1>
      <div className={twMerge(cardClass, 'mt-2 overflow-hidden')}>
        {courses.map((course) => (
          <ListRow
            key={course.id}
            href={`/course/${course.id}`}
            title={course.name}
            meta={
              course.isArchived
                ? t('control.home.archived')
                : t('control.home.liveQuizCount', {
                    count: countControllable(course.liveQuizzes) ?? 0,
                  })
            }
            dimmed={course.isArchived ?? false}
            dataCy={`course-${course.name}`}
          />
        ))}
        <ListRow
          href="/course/unassigned"
          title={t('control.home.noCourse')}
          meta={
            typeof unassignedCount === 'number'
              ? t('control.home.liveQuizCount', { count: unassignedCount })
              : undefined
          }
          dataCy="unassigned-live-quizzes"
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

export default Index
