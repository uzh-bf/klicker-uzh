import { useQuery } from '@apollo/client'
import dayjs from 'dayjs'
import Head from 'next/head'
import { useMemo, useState } from 'react'
import { Dropdown, Icon } from 'semantic-ui-react'
import { twMerge } from 'tailwind-merge'

import { PageWithFeatureFlags } from '../../@types/AppFlags'
import ConfusionBarometer from '../../components/interaction/confusion/ConfusionBarometer'
import PinnedFeedbacksQuery from '../../graphql/queries/PinnedFeedbacksQuery.graphql'
import ConfusionAddedSubscription from '../../graphql/subscriptions/ConfusionAddedSubscription.graphql'
import withFeatureFlags from '../../lib/withFeatureFlags'

function Feedbacks({ featureFlags }: PageWithFeatureFlags) {
  const [sortBy, setSortBy] = useState('upvotes')

  const { data, loading, error, subscribeToMore } = useQuery(PinnedFeedbacksQuery, {
    pollInterval: 10000,
  })

  const aggregateConfusion = useMemo(() => {
    if (data?.runningSession?.confusionValues && data?.runningSession?.confusionValues.numOfFeedbacks > 0) {
      return Math.max(
        Math.abs(data?.runningSession?.confusionValues.speed),
        Math.abs(data?.runningSession?.confusionValues.difficulty)
      )
    }
    return 0
  }, [data])

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
    return <div className="p-4">Loading...</div>
  }

  if (!data?.pinnedFeedbacks) {
    return <div className="p-4">No data available...</div>
  }

  if (error) {
    return <div className="p-4">Error: {error.message}</div>
  }

  const withConfusionBarometer = data.runningSession.settings.isConfusionBarometerActive

  const { pinnedFeedbacks } = data

  return (
    <div
      className={twMerge(
        'flex flex-row p-4 gap-8',
        withConfusionBarometer && 'border-t-[30px] border-t-only border-solid',
        withConfusionBarometer && borderColor
      )}
    >
      <Head>
        <title>Feedbacks</title>
      </Head>

      <div className="flex-1">
        <Dropdown
          selection
          options={[
            { text: 'Sort by Upvotes', value: 'upvotes' },
            { text: 'Sort by Recency', value: 'recency' },
          ]}
          value={sortBy}
          onChange={(_, { value }) => setSortBy(value as string)}
        />

        {pinnedFeedbacks?.length === 0 && (
          <div className="mt-4 flex items-center border border-solid bg-primary-10% border-primary text-2xl p-4">
            No feedbacks received or pinned yet...
          </div>
        )}

        {pinnedFeedbacks.map(({ id, content, createdAt, votes }) => (
          <div className="mt-4 flex items-center border border-solid bg-primary-10% border-primary" key={id}>
            <div className="flex-1 p-4">
              <p className="mb-0 text-2xl">{content}</p>
              <div className="flex flex-row mt-2 text-lg text-gray-500">
                <div>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
              </div>
            </div>
            <div className="flex flex-col justify-between flex-initial pr-4">
              <div className="text-3xl text-gray-500">
                {votes} <Icon name="thumbs up outline" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {withConfusionBarometer && (
        <div className="flex-initial">
          <div className="flex-initial p-4 w-[300px] bg-primary-bg rounded shadow print:hidden border-primary border-solid border">
            <ConfusionBarometer
              confusionValues={data.runningSession.confusionValues}
              subscribeToMore={(): void => {
                subscribeToMore({
                  document: ConfusionAddedSubscription,
                  updateQuery: (prev, { subscriptionData }): any => {
                    if (!subscriptionData.data) return prev
                    return {
                      ...prev,
                      runningSession: {
                        ...prev.runningSession,
                        confusionValues: {
                          speed: subscriptionData.data.confusionAdded.speed,
                          difficulty: subscriptionData.data.confusionAdded.difficulty,
                          numOfFeedbacks: subscriptionData.data.confusionAdded.numOfFeedbacks,
                        },
                      },
                    }
                  },
                  variables: { sessionId: data.runningSession.id },
                })
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default withFeatureFlags(Feedbacks)
