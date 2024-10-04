import { useQuery } from '@apollo/client'
import {
  GetUserSessionsDocument,
  SessionStatus,
  Session as SessionType,
} from '@klicker-uzh/graphql/dist/ops'
import Session from '../../components/sessions/Session'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'
import Layout from '../../components/Layout'

function QuizList() {
  const t = useTranslations()

  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUserSessionsDocument)

  const runningSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session.status === SessionStatus.Running)
      .sort((a, b) => (dayjs(a.startedAt) > dayjs(b.startedAt) ? 1 : -1))
  }, [dataSessions])

  const scheduledSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SessionStatus.Scheduled)
      .sort((a, b) => (dayjs(b.createdAt) > dayjs(a.createdAt) ? 1 : -1))
  }, [dataSessions])

  const preparedSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SessionStatus.Prepared)
      .sort((a, b) => (dayjs(b.createdAt) > dayjs(a.createdAt) ? 1 : -1))
  }, [dataSessions])

  const completedSessions = useMemo(() => {
    return dataSessions?.userSessions
      ?.filter((session) => session?.status === SessionStatus.Completed)
      .sort((a, b) => (dayjs(b.finishedAt) > dayjs(a.finishedAt) ? 1 : -1))
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
                <Session key={session.id} session={session as SessionType} />
              ))}
            </div>
          </div>
        )}
        {scheduledSessions && scheduledSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.plannedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {scheduledSessions.map((session) => (
                <Session key={session.id} session={session as SessionType} />
              ))}
            </div>
          </div>
        )}
        {preparedSessions && preparedSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.preparedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {preparedSessions.map((session) => (
                <Session key={session.id} session={session as SessionType} />
              ))}
            </div>
          </div>
        )}
        {completedSessions && completedSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.completedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {completedSessions.map((session) => (
                <Session key={session.id} session={session as SessionType} />
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
                  <Link
                    href="/"
                    className="text-primary-100 hover:underline"
                    legacyBehavior
                    passHref
                  >
                    <a data-cy="create-first-session">{text}</a>
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

export default QuizList
