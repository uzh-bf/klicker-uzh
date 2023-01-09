import { useQuery } from '@apollo/client'
import { GetUserSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useMemo } from 'react'
import { SESSION_STATUS } from 'shared-components/src/constants'
import Layout from '../../components/Layout'
import SessionLists from '../../components/sessions/SessionLists'

function UnassignedSessions() {
  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUserSessionsDocument)

  const runningSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session.course === null)
      ?.filter((session) => session.status === SESSION_STATUS.RUNNING)
      .sort((a, b) => b.startedAt - a.startedAt)
  }, [dataSessions])

  const plannedSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session.course === null)
      ?.filter(
        (session) =>
          session.status === SESSION_STATUS.SCHEDULED ||
          session.status === SESSION_STATUS.PREPARED
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [dataSessions])

  if (loadingSessions) {
    return <Layout title="Sessionen ohne Kurs">Loading...</Layout>
  }
  if (errorSessions || !dataSessions) {
    return (
      <Layout title="Sessionen ohne Kurs">
        <UserNotification
          notificationType="error"
          className={{ root: 'text-base' }}
          message="Beim Laden Ihrer Sessionen ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut."
        />
      </Layout>
    )
  }

  return (
    <Layout title="Sessionen ohne Kurs">
      <SessionLists
        runningSessions={runningSessions || []}
        plannedSessions={plannedSessions || []}
      />
    </Layout>
  )
}

export default UnassignedSessions
