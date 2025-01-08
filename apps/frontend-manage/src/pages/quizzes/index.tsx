import { useQuery } from '@apollo/client'
import {
  GetUserLiveQuizzesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo } from 'react'
import Layout from '../../components/Layout'
import LiveQuiz from '../../components/liveQuiz/LiveQuiz'

function LiveQuizList() {
  const t = useTranslations()

  const { loading, data } = useQuery(GetUserLiveQuizzesDocument)

  const runningLiveQuizzes = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((quiz) => quiz.status === PublicationStatus.Published)
      .sort((a, b) => (dayjs(a.startedAt) > dayjs(b.startedAt) ? 1 : -1))
  }, [data])

  const scheduledLiveQuizzes = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((quiz) => quiz?.status === PublicationStatus.Scheduled)
      .sort((a, b) => (dayjs(b.createdAt) > dayjs(a.createdAt) ? 1 : -1))
  }, [data])

  const preparedLiveQuizzes = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((quiz) => quiz?.status === PublicationStatus.Draft)
      .sort((a, b) => (dayjs(b.createdAt) > dayjs(a.createdAt) ? 1 : -1))
  }, [data])

  const completedLiveQuizzes = useMemo(() => {
    return data?.userLiveQuizzes
      ?.filter((quiz) => quiz?.status === PublicationStatus.Ended)
      .sort((a, b) => (dayjs(b.finishedAt) > dayjs(a.finishedAt) ? 1 : -1))
  }, [data])

  if (loading) {
    return (
      <Layout displayName={t('shared.generic.liveQuizzes')}>
        <Loader />
      </Layout>
    )
  }

  console.log(data)

  return (
    <Layout displayName={t('shared.generic.liveQuizzes')}>
      <div className="flex flex-col gap-5">
        {runningLiveQuizzes && runningLiveQuizzes.length > 0 && (
          <div>
            <H2>{t('manage.liveQuizzes.runningLiveQuizzes')}</H2>
            <div className="flex flex-col gap-2">
              {runningLiveQuizzes.map((quiz) => (
                <LiveQuiz key={quiz.id} quiz={quiz} />
              ))}
            </div>
          </div>
        )}
        {scheduledLiveQuizzes && scheduledLiveQuizzes.length > 0 && (
          <div>
            <H2>{t('manage.liveQuizzes.plannedLiveQuizzes')}</H2>
            <div className="flex flex-col gap-2">
              {scheduledLiveQuizzes.map((quiz) => (
                <LiveQuiz key={quiz.id} quiz={quiz} />
              ))}
            </div>
          </div>
        )}
        {preparedLiveQuizzes && preparedLiveQuizzes.length > 0 && (
          <div>
            <H2>{t('manage.liveQuizzes.preparedLiveQuizzes')}</H2>
            <div className="flex flex-col gap-2">
              {preparedLiveQuizzes.map((quiz) => (
                <LiveQuiz key={quiz.id} quiz={quiz} />
              ))}
            </div>
          </div>
        )}
        {completedLiveQuizzes && completedLiveQuizzes.length > 0 && (
          <div>
            <H2>{t('manage.liveQuizzes.completedLiveQuizzes')}</H2>
            <div className="flex flex-col gap-2">
              {completedLiveQuizzes.map((quiz) => (
                <LiveQuiz key={quiz.id} quiz={quiz} />
              ))}
            </div>
          </div>
        )}
        {scheduledLiveQuizzes?.length === 0 &&
          preparedLiveQuizzes?.length === 0 &&
          runningLiveQuizzes?.length === 0 &&
          completedLiveQuizzes?.length === 0 && (
            <UserNotification
              type="warning"
              message={t('manage.liveQuizzes.noLiveQuizzes')}
              className={{ message: 'font-bold' }}
            >
              {t.rich('manage.liveQuizzes.creationExplanation', {
                link: (text) => (
                  <Link
                    href="/"
                    className="text-primary-100 hover:underline"
                    legacyBehavior
                    passHref
                  >
                    <a data-cy="create-first-live-quiz">{text}</a>
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

export default LiveQuizList
