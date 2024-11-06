import { useQuery } from '@apollo/client'
import {
  GetUnassignedLiveQuizzesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import Layout from '../../components/Layout'
import LiveQuizLists from '../../components/liveQuizzes/LiveQuizLists'

function UnassignedLiveQuizzes() {
  const t = useTranslations()
  const { data, loading, error } = useQuery(GetUnassignedLiveQuizzesDocument)

  const runningQuizzes = useMemo(() => {
    return data?.unassignedLiveQuizzes?.filter(
      (quiz) => quiz.status === PublicationStatus.Published
    )
  }, [data])

  const plannedQuizzes = useMemo(() => {
    return data?.unassignedLiveQuizzes?.filter(
      (quiz) =>
        quiz.status === PublicationStatus.Scheduled ||
        quiz.status === PublicationStatus.Draft
    )
  }, [data])

  if (loading) {
    return (
      <Layout title={t('control.home.liveQuizzesNoCourse')}>
        <Loader />
      </Layout>
    )
  }
  if (error || !data) {
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
