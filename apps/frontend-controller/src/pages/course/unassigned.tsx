import { useQuery } from '@apollo/client'
import { GetUserSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { SESSION_STATUS } from 'shared-components/src/constants'
import SessionLists from '../../components/common/SessionLists'
import Layout from '../../components/Layout'

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
