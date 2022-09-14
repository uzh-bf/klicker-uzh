import { useQuery } from '@apollo/client'
import {
  GetUserSessionsDocument,
  Session as SessionType,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import Session from '../../components/sessions/Session'

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
  const scheduledSessions = useMemo(
    () =>
      dataSessions?.userSessions?.filter(
        (session) => session?.status === 'SCHEDULED'
      ),
    [dataSessions]
  )
  const preparedSessions = useMemo(
    () =>
      dataSessions?.userSessions?.filter(
        (session) => session?.status === 'PREPARED'
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

  if (!dataSessions || loadingSessions) {
    return <div>Loading...</div>
  }

  return (
    <Layout displayName="Sessions">
      <div className="mx-auto max-w-7xl">
        {runningSessions && runningSessions.length > 0 && (
          <Session
            sessionName="Laufende Sessionen"
            sessionList={runningSessions as SessionType[]}
          />
        )}
        {scheduledSessions && scheduledSessions.length > 0 && (
          <Session
            sessionName="Geplante Sessionen"
            sessionList={scheduledSessions as SessionType[]}
          />
        )}
        {preparedSessions && preparedSessions.length > 0 && (
          <Session
            sessionName="Vorbereitete Sessionen"
            sessionList={preparedSessions as SessionType[]}
          />
        )}
        {completedSessions && completedSessions.length > 0 && (
          <Session
            sessionName="Abgeschlossene Sessionen"
            sessionList={completedSessions as SessionType[]}
          />
        )}
      </div>
    </Layout>
  )
}

export default SessionList
