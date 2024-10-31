import { useQuery } from '@apollo/client'
import {
  GetUserLiveQuizzesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Session from '../../components/sessions/LiveQuiz'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'
import Layout from '../../components/Layout'

function SessionList() {
  const t = useTranslations()

  const { loading, data } = useQuery(GetUserLiveQuizzesDocument)

  const runningSessions = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((session) => session.status === PublicationStatus.Published)
      .sort((a, b) => (dayjs(a.startedAt) > dayjs(b.startedAt) ? 1 : -1))
  }, [data])

  const scheduledSessions = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((session) => session?.status === PublicationStatus.Scheduled)
      .sort((a, b) => (dayjs(b.createdAt) > dayjs(a.createdAt) ? 1 : -1))
  }, [data])

  const preparedSessions = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((session) => session?.status === PublicationStatus.Draft)
      .sort((a, b) => (dayjs(b.createdAt) > dayjs(a.createdAt) ? 1 : -1))
  }, [data])

  const completedSessions = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((session) => session?.status === PublicationStatus.Ended)
      .sort((a, b) => (dayjs(b.finishedAt) > dayjs(a.finishedAt) ? 1 : -1))
  }, [data])

  if (!data || loading) {
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
                <Session key={session.id} quiz={session} />
              ))}
            </div>
          </div>
        )}
        {scheduledSessions && scheduledSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.plannedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {scheduledSessions.map((session) => (
                <Session key={session.id} quiz={session} />
              ))}
            </div>
          </div>
        )}
        {preparedSessions && preparedSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.preparedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {preparedSessions.map((session) => (
                <Session key={session.id} quiz={session} />
              ))}
            </div>
          </div>
        )}
        {completedSessions && completedSessions.length > 0 && (
          <div>
            <H2>{t('manage.sessions.completedSessions')}</H2>
            <div className="flex flex-col gap-2">
              {completedSessions.map((session) => (
                <Session key={session.id} quiz={session} />
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

export default SessionList
