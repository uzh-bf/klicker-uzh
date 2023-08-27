import { useQuery } from '@apollo/client'
import {
  GetUserSessionsDocument,
  SessionStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Session from '../../components/sessions/Session'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'
import Layout from '../../components/Layout'

function SessionList() {
  const t = useTranslations()

  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUserSessionsDocument)

  const runningSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session.status === SessionStatus.Running)
      .sort((a, b) => b.startedAt - a.startedAt)
  }, [dataSessions])

  const scheduledSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SessionStatus.Scheduled)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [dataSessions])

  const preparedSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SessionStatus.Prepared)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [dataSessions])

  const completedSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SessionStatus.Completed)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [dataSessions])

  if (!dataSessions || loadingSessions) {
    return (
      <Layout displayName="Sessions">
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout displayName="Sessions">
      <div className="flex flex-col gap-5">
        {runningSessions && runningSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.runningSessions')}</H2>
            <div className="flex flex-col gap-2">
              {runningSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
        {scheduledSessions && scheduledSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.plannedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {scheduledSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
        {preparedSessions && preparedSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.preparedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {preparedSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
        {completedSessions && completedSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.completedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {completedSessions.map((session) => (
                <Session key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}
        {scheduledSessions?.length === 0 &&
          preparedSessions?.length === 0 &&
          runningSessions?.length === 0 &&
          completedSessions?.length === 0 && (
            <UserNotification
              type="warning"
              message={t('manage.sessions.noSessions')}
              className={{ message: 'font-bold' }}
            >
              {t.rich('manage.sessions.creationExplanation', {
                link: (text) => (
                  <Link href="/" className="text-primary hover:underline">
                    {text}
                  </Link>
                ),
              })}
            </UserNotification>
          )}
      </div>
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

export default SessionList
