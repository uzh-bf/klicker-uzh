import { useQuery } from '@apollo/client'
import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Feedback,
  GetPinnedFeedbacksDocument,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import Head from 'next/head'
import { useMemo } from 'react'
import ConfusionCharts from '../../../components/interaction/confusion/ConfusionCharts'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

function LecturerView() {
  const t = useTranslations()
  const router = useRouter()

  const { data, loading, error, subscribeToMore } = useQuery(
    GetPinnedFeedbacksDocument,
    {
      variables: {
        id: router.query.id as string,
      },
      pollInterval: 5000,
      skip: !router.query.id,
    }
  )

  const aggregateConfusion = useMemo(() => {
    if (
      data?.pinnedFeedbacks &&
      data?.pinnedFeedbacks.confusionSummary &&
      (data?.pinnedFeedbacks.confusionSummary.numberOfParticipants ?? -1) > 0
    ) {
      return Math.max(
        Math.abs(data?.pinnedFeedbacks.confusionSummary.speed),
        Math.abs(data?.pinnedFeedbacks.confusionSummary.difficulty)
      )
    }
    return 0
  }, [data?.pinnedFeedbacks])

  const borderColor = useMemo(() => {
    if (aggregateConfusion >= 1.4) {
      return 'border-red-300'
    }

    if (aggregateConfusion >= 0.7) {
      return 'border-yellow-300'
    }

    return 'border-green-300'
  }, [aggregateConfusion])

  if (loading) {
    return <Loader />
  }

  if (!data) {
    return <div className="p-4">{t('manage.lecturer.noDataAvailable')}</div>
  }

  const isLiveQAEnabled = data?.pinnedFeedbacks?.isLiveQAEnabled
  const isConfusionFeedbackEnabled =
    data?.pinnedFeedbacks?.isConfusionFeedbackEnabled
  const confusionSummary = data?.pinnedFeedbacks?.confusionSummary
  const feedbacks = data?.pinnedFeedbacks?.feedbacks

  if (!isLiveQAEnabled && !isConfusionFeedbackEnabled) {
    return (
      <div className="p-4">
        {t('manage.lecturer.audienceInteractionNotActivated')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        {t('shared.generic.error')}: {error.message}
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'border-t-only flex flex-row gap-8 border-t-[30px] border-solid p-4',
        borderColor
      )}
    >
      <Head>
        <title>{t('shared.generic.feedbacks')}</title>
      </Head>

      {isLiveQAEnabled && (
        <div className="flex-1">
          {/* // TODO: readd dropdown to allow lecturer to sort feedbacks according to preferences
        <Dropdown
          selection
          options={[
            { text: 'Sort by Upvotes', value: 'upvotes' },
            { text: 'Sort by Recency', value: 'recency' },
          ]}
          value={sortBy}
          onChange={(_, { value }) => setSortBy(value as string)}
        /> */}

          {feedbacks?.length === 0 && (
            <div className="border-primary-100 mt-4 flex items-center rounded border border-solid p-4 text-2xl">
              {t('manage.lecturer.noFeedbacks')}
            </div>
          )}

          {feedbacks?.map(({ id, content, createdAt, votes }: Feedback) => (
            <div
              className="border-primary-100 mt-4 flex items-center rounded border border-solid"
              key={id}
            >
              <div className="flex-1 p-4">
                <p className="mb-0 text-2xl">{content}</p>
                <div className="mt-2 flex flex-row text-lg text-gray-500">
                  <div>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
                </div>
              </div>
              <div className="flex flex-initial flex-col justify-between pr-4">
                <div className="text-3xl text-gray-500">
                  {votes}{' '}
                  <FontAwesomeIcon icon={faThumbsUp} className="mr-0.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isConfusionFeedbackEnabled && (
        <div className="mt-4 flex-initial">
          <div className="border-primary-100 w-[300px] flex-initial rounded border border-solid p-4 shadow print:hidden">
            <ConfusionCharts confusionValues={confusionSummary ?? undefined} />
          </div>
        </div>
      )}
    </div>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default LecturerView
