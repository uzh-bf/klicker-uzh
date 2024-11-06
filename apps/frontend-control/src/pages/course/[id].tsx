import { useQuery } from '@apollo/client'
import {
  GetControlCourseDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Layout from '../../components/Layout'
import LiveQuizLists from '../../components/liveQuizzes/LiveQuizLists'

function Course() {
  const t = useTranslations()
  const router = useRouter()

  const { loading, error, data } = useQuery(GetControlCourseDocument, {
    variables: { courseId: router.query.id as string },
    skip: !router.query.id,
  })

  useEffect(() => {
    if (data && !data.controlCourse) {
      router.push('/404')
    }
  }, [data, router])

  if (loading) {
    return (
      <Layout title={t('control.course.courseOverview')}>
        <Loader />
      </Layout>
    )
  }

  if (!data?.controlCourse || error) {
    return (
      <Layout title={t('control.course.courseOverview')}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.course.loadingFailed')}
        />
      </Layout>
    )
  }

  const { controlCourse } = data

  const runningQuizzes = controlCourse.liveQuizzes?.filter(
    (quiz) => quiz.status === PublicationStatus.Published
  )
  const plannedQuizzes = controlCourse.liveQuizzes?.filter(
    (quiz) =>
      quiz.status === PublicationStatus.Draft ||
      quiz.status === PublicationStatus.Scheduled
  )

  return (
    <Layout title={controlCourse.name}>
      <LiveQuizLists
        runningLiveQuizzes={runningQuizzes || []}
        plannedLiveQuizzes={plannedQuizzes || []}
      />

      <div className="mt-4 text-base italic">
        {t('control.course.completedLiveQuizzesHint')}
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

export default Course
