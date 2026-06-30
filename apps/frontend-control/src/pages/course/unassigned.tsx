import Loader from '@klicker-uzh/shared-components/src/Loader'
import { trpc, type RouterOutputs } from '@lib/trpc'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import Layout from '../../components/Layout'
import LiveQuizLists from '../../components/liveQuizzes/LiveQuizLists'

const publicationStatus = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  scheduled: 'SCHEDULED',
} as const

type UnassignedLiveQuiz =
  RouterOutputs['liveQuiz']['unassigned']['liveQuizzes'][number]

function UnassignedLiveQuizzes() {
  const t = useTranslations()
  const {
    data,
    isLoading: loading,
    error,
  } = trpc.liveQuiz.unassigned.useQuery()
  const hasLiveQuizData = typeof data !== 'undefined'

  const runningQuizzes = useMemo(() => {
    return data?.liveQuizzes.filter(
      (quiz: UnassignedLiveQuiz) => quiz.status === publicationStatus.published
    )
  }, [data])

  const plannedQuizzes = useMemo(() => {
    return data?.liveQuizzes.filter(
      (quiz: UnassignedLiveQuiz) =>
        quiz.status === publicationStatus.scheduled ||
        quiz.status === publicationStatus.draft
    )
  }, [data])

  if (loading && !hasLiveQuizData) {
    return (
      <Layout title={t('control.home.liveQuizzesNoCourse')}>
        <Loader />
      </Layout>
    )
  }
  if (error && !hasLiveQuizData) {
    return (
      <Layout title={t('control.home.liveQuizzesNoCourse')}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.home.loadingLiveQuizzesFailed')}
        />
      </Layout>
    )
  }
  if (!data) {
    return (
      <Layout title={t('control.home.liveQuizzesNoCourse')}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.home.loadingLiveQuizzesFailed')}
        />
      </Layout>
    )
  }

  return (
    <Layout title={t('control.home.liveQuizzesNoCourse')}>
      {error && data ? (
        <UserNotification
          type="error"
          className={{ root: 'mb-4 text-base' }}
          message={t('control.home.loadingLiveQuizzesFailed')}
        />
      ) : null}
      <LiveQuizLists
        runningLiveQuizzes={runningQuizzes || []}
        plannedLiveQuizzes={plannedQuizzes || []}
      />
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

export default UnassignedLiveQuizzes
