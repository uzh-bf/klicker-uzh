import { useQuery } from '@apollo/client'
import Session from '@components/sessions/Session'
import { GetUserSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useMemo } from 'react'
import { Session as SessionType } from '@klicker-uzh/graphql/dist/ops'


import Layout from '../../components/Layout'

function SessionList() {
  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUserSessionsDocument)

  const runningSessions = useMemo(
    () =>
      dataSessions?.userSessions?.filter(
        (session) => session?.status === 'RUNNING'
      ),
    [dataSessions]
  )
  const preparedScheduledSessions = useMemo(
    () =>
      dataSessions?.userSessions?.filter(
        (session) =>
          session?.status === 'PREPARED' || session?.status === 'SCHEDULED'
      ),
    [dataSessions]
  )
  const completedSessions = useMemo(
    () =>
      dataSessions?.userSessions?.filter(
        (session) => session?.status === 'COMPLETED'
      ),
    [dataSessions]
  )

  console.log('runningSession', runningSessions)
  console.log('preparedScheduledSessions', preparedScheduledSessions)
  console.log('completedSessions', completedSessions)

  if (!dataSessions || loadingSessions) {
    return <div>Loading...</div>
  }

  return (
    <Layout displayName="Sessions">
      <div className="mx-auto bg-red-300 max-w-7xl">
        {runningSessions && runningSessions.length > 0 && (
          <Session sessionName="Laufende Sessionen" sessionList={runningSessions as SessionType[]} />
        )}
        {preparedScheduledSessions && preparedScheduledSessions.length > 0 && (
          <Session sessionName="Vorbereitete Sessionen" sessionList={preparedScheduledSessions as SessionType[]} />
        )}
        {completedSessions && completedSessions.length > 0 && (
          <Session sessionName="Abgeschlossene Sessionen" sessionList={completedSessions as SessionType[]} />
        )}
      </div>
    </Layout>
  )
}

export default SessionList
