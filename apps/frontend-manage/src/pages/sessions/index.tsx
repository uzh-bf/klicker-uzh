import { useQuery } from '@apollo/client'
import {
  GetUserSessionsDocument,
  Session as SessionType,
} from '@klicker-uzh/graphql/dist/ops'
import Session from '../../components/sessions/Session'

import { useMemo } from 'react'
import Layout from '../../components/Layout'

function SessionList() {
  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUserSessionsDocument)

  const {
    RUNNING: runningSessions,
    SCHEDULED: scheduledSessions,
    PREPARED: preparedSessions,
    COMPLETED: completedSessions,
  } = useMemo(
    () =>
      dataSessions?.userSessions?.reduce(
        (memo, x) => {
          memo[x['status']].push(x as SessionType)
          return memo
        },
        {
          RUNNING: new Array<SessionType>(),
          SCHEDULED: new Array<SessionType>(),
          PREPARED: new Array<SessionType>(),
          COMPLETED: new Array<SessionType>(),
        }
      ) || { RUNNING: [], SCHEDULED: [], PREPARED: [], COMPLETED: [] },
    [dataSessions]
  )

  if (!dataSessions || loadingSessions) {
    return <div>Loading...</div>
  }

  return (
    <Layout displayName="Sessions">
      <div className="">
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
