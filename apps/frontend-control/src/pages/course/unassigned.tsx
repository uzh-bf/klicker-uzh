import { useQuery } from '@apollo/client'
import {
  GetUnassignedSessionsDocument,
  SessionStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import Layout from '../../components/Layout'
import SessionLists from '../../components/sessions/SessionLists'

function UnassignedSessions() {
  const t = useTranslations()
  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUnassignedSessionsDocument)

  const runningSessions = useMemo(() => {
    return dataSessions?.unassignedSessions?.filter(
      (session) => session.status === SessionStatus.Running
    )
  }, [dataSessions])

  const plannedSessions = useMemo(() => {
    return dataSessions?.unassignedSessions?.filter(
      (session) =>
        session.status === SessionStatus.Scheduled ||
        session.status === SessionStatus.Prepared
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

export default UnassignedSessions
