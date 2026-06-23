import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc } from '@lib/trpc'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import LiveQuizLists from '../../components/liveQuizzes/LiveQuizLists'

const publicationStatus = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  scheduled: 'SCHEDULED',
} as const

function Course() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.id
  const validCourseId = typeof courseId === 'string' ? courseId : undefined
  const [redirectFailed, setRedirectFailed] = useState(false)

  const {
    isLoading: loading,
    error,
    data,
  } = trpc.course.controlCourse.useQuery(
    { courseId: validCourseId ?? '' },
    { enabled: typeof validCourseId !== 'undefined' }
  )
  const controlCourse = data?.controlCourse
  const missingControlCourse = Boolean(data && !controlCourse)

  useEffect(() => {
    if (!missingControlCourse || redirectFailed) return

    let cancelled = false

    const redirectToNotFound = async () => {
      try {
        const navigated = await router.push('/404')
        if (!navigated && !cancelled) {
          window.location.assign('/404')
        }
      } catch (error) {
        if ((error as { cancelled?: boolean }).cancelled) return

        console.error(error)
        if (!cancelled) {
          setRedirectFailed(true)
        }
      }
    }

    void redirectToNotFound()

    return () => {
      cancelled = true
    }
  }, [missingControlCourse, redirectFailed, router])

  if (
    (loading || (missingControlCourse && !redirectFailed)) &&
    !controlCourse
  ) {
    return (
      <Layout title={t('control.course.courseOverview')}>
        <Loader />
      </Layout>
    )
  }

  if (error && !controlCourse) {
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

  if (!controlCourse) {
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

  const runningQuizzes = controlCourse.liveQuizzes?.filter(
    (quiz) => quiz.status === publicationStatus.published
  )
  const plannedQuizzes = controlCourse.liveQuizzes?.filter(
    (quiz) =>
      quiz.status === publicationStatus.draft ||
      quiz.status === publicationStatus.scheduled
  )

  return (
    <Layout title={controlCourse.name}>
      {error && controlCourse ? (
        <UserNotification
          type="error"
          className={{ root: 'mb-4 text-base' }}
          message={t('control.course.loadingFailed')}
        />
      ) : null}
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
