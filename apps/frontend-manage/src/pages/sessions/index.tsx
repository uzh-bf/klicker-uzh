import { useQuery } from '@apollo/client'
import {
  GetUserSessionsDocument,
  Session as SessionType,
} from '@klicker-uzh/graphql/dist/ops'
import Session from '../../components/sessions/Session'

import { useMemo } from 'react'
import { SESSION_STATUS } from 'shared-components/src/constants'
import Layout from '../../components/Layout'

function SessionList() {
  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUserSessionsDocument)

  const runningSessions = useMemo(() => {
    return dataSessions?.userSessions?.filter(
      (session) => session.status === SESSION_STATUS.RUNNING
    )
  }, [dataSessions])

  const scheduledSessions = useMemo(() => {
    return dataSessions?.userSessions?.filter(
      (session) => session?.status === SESSION_STATUS.SCHEDULED
    )
  }, [dataSessions])

  const preparedSessions = useMemo(() => {
    return dataSessions?.userSessions?.filter(
      (session) => session?.status === SESSION_STATUS.PREPARED
    )
  }, [dataSessions])

  const completedSessions = useMemo(() => {
    return dataSessions?.userSessions?.filter(
      (session) => session?.status === SESSION_STATUS.COMPLETED
    )
  }, [dataSessions])

  if (!dataSessions || loadingSessions) {
    return <div>Loading...</div>
  }

  return (
    <Layout displayName="Sessions">
      <div className="flex flex-col gap-5">
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
