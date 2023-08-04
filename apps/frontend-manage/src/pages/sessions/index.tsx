import { useQuery } from '@apollo/client'
import { GetUserSessionsDocument } from '@klicker-uzh/graphql/dist/ops'
import Session from '../../components/sessions/Session'

import { H2 } from '@uzh-bf/design-system'
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
    return dataSessions?.userSessions
      ?.filter((session) => session.status === SESSION_STATUS.RUNNING)
      .sort((a, b) => b.startedAt - a.startedAt)
  }, [dataSessions])

  const scheduledSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SESSION_STATUS.SCHEDULED)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [dataSessions])

  const preparedSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SESSION_STATUS.PREPARED)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [dataSessions])

  const completedSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SESSION_STATUS.COMPLETED)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [dataSessions])

  if (!dataSessions || loadingSessions) {
    return <div>Loading...</div>
  }

  return (
    <Layout displayName="Sessions">
      <div className="flex flex-col gap-5">
        {runningSessions && runningSessions.length > 0 && (
          <div>
            <H2>Laufende Sessionen</H2>
            <div className="flex flex-col gap-2">
              {runningSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
        {scheduledSessions && scheduledSessions.length > 0 && (
          <div>
            <H2>Geplante Sessionen</H2>
            <div className="flex flex-col gap-2">
              {scheduledSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
        {preparedSessions && preparedSessions.length > 0 && (
          <div>
            <H2>Vorbereitete Sessionen</H2>
            <div className="flex flex-col gap-2">
              {preparedSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
        {completedSessions && completedSessions.length > 0 && (
          <div>
            <H2>Abgeschlossene Sessionen</H2>
            <div className="flex flex-col gap-2">
              {completedSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
    revalidate: 600,
  }
}

export default SessionList
