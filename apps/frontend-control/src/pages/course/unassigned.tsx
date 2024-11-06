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
import SessionLists from '../../components/liveQuizzes/SessionLists'

function UnassignedLiveQuizzes() {
  const t = useTranslations()
  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUnassignedLiveQuizzesDocument)

  const runningSessions = useMemo(() => {
    return dataSessions?.unassignedLiveQuizzes?.filter(
      (session) => session.status === PublicationStatus.Published
    )
  }, [dataSessions])

  const plannedSessions = useMemo(() => {
    return dataSessions?.unassignedLiveQuizzes?.filter(
      (session) =>
        session.status === PublicationStatus.Scheduled ||
        session.status === PublicationStatus.Draft
    )
  }, [dataSessions])

  if (loadingSessions) {
    return (
      <Layout title={t('control.home.sessionsNoCourse')}>
        <Loader />
      </Layout>
    )
  }
  if (errorSessions || !dataSessions) {
    return (
      <Layout title={t('control.home.sessionsNoCourse')}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message="Beim Laden Ihrer Sessionen ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut."
        />
      </Layout>
    )
  }

  return (
    <Layout title={t('control.home.sessionsNoCourse')}>
      <SessionLists
        runningSessions={runningSessions || []}
        plannedSessions={plannedSessions || []}
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
