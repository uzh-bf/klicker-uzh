import { useQuery } from '@apollo/client'
import { GetUnassignedSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
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
  } = useQuery(GetUnassignedSessionsDocument)

  const runningSessions = useMemo(() => {
    return dataSessions?.unassignedSessions?.filter(
      (session) => session.status === SESSION_STATUS.RUNNING
    )
  }, [dataSessions])

  const plannedSessions = useMemo(() => {
    return dataSessions?.unassignedSessions?.filter(
      (session) =>
        session.status === SESSION_STATUS.SCHEDULED ||
        session.status === SESSION_STATUS.PREPARED
    )
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
