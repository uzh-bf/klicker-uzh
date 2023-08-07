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
      data?.pinnedFeedbacks.confusionSummary.numberOfParticipants > 0
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
    return <div className="p-4">{t('shared.generic.loading')}</div>
  }

  if (!data) {
    return <div className="p-4">{t('manage.lecturer.noDataAvailable')}</div>
  }

  const {
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    confusionSummary,
    feedbacks,
  } = data?.pinnedFeedbacks

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
        'flex flex-row p-4 gap-8 border-t-[30px] border-t-only border-solid',
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
            <div className="mt-4 flex items-center border border-solid bg-primary-10% border-primary text-2xl p-4">
              {t('manage.lecturer.noFeedbacks')}
            </div>
          )}

          {feedbacks.map(({ id, content, createdAt, votes }: Feedback) => (
            <div
              className="mt-4 flex items-center border border-solid bg-primary-10% border-primary"
              key={id}
            >
              <div className="flex-1 p-4">
                <p className="mb-0 text-2xl">{content}</p>
                <div className="flex flex-row mt-2 text-lg text-gray-500">
                  <div>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
                </div>
              </div>
              <div className="flex flex-col justify-between flex-initial pr-4">
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
        <div className="flex-initial">
          <div className="flex-initial p-4 w-[300px] bg-primary-bg rounded shadow print:hidden border-primary border-solid border">
            <ConfusionCharts confusionValues={confusionSummary} />
          </div>
        </div>
      )}
    </div>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
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
