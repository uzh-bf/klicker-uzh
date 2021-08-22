import React from 'react'
import { useMutation } from '@apollo/client'
import { Checkbox } from 'semantic-ui-react'
import ConfusionBarometer from './confusion/ConfusionBarometer'
import FeedbackChannel from './feedbacks/FeedbackChannel'

import DeleteFeedbackMutation from '../../graphql/mutations/DeleteFeedbackMutation.graphql'
import FeedbackAddedSubscription from '../../graphql/subscriptions/FeedbackAddedSubscription.graphql'
import ConfusionAddedSubscription from '../../graphql/subscriptions/ConfusionAddedSubscription.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import UpdateSessionSettingsMutation from '../../graphql/mutations/UpdateSessionSettingsMutation.graphql'

interface Props {
  sessionId: string
  confusionTS: any[]
  feedbacks: any[]
  isFeedbackChannelActive: boolean
  isFeedbackChannelPublic: boolean
  isConfusionBarometerActive: boolean
  subscribeToMore: (obj: any) => void
}

function AudienceInteraction({
  sessionId,
  confusionTS,
  feedbacks,
  isFeedbackChannelActive,
  isFeedbackChannelPublic,
  isConfusionBarometerActive,
  subscribeToMore,
}: Props) {
  const [deleteFeedback, { loading: isDeleteFeedbackLoading }] = useMutation(DeleteFeedbackMutation)
  const [updateSettings, { loading: isUpdateSettingsLoading }] = useMutation(UpdateSessionSettingsMutation)

  return (
    <div>
      <div className="flex flex-row justify-between">
        <div className="mb-4 text-2xl font-bold">Audience Interaction</div>
        <div>
          <Checkbox checked defaultChecked toggle label="TOGGLE" onChange={() => null} />
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="flex-1 mb-8 md:mb-0 md:pr-8">
          <FeedbackChannel
            feedbacks={feedbacks}
            handleActiveToggle={(): void => {
              updateSettings({
                refetchQueries: [{ query: RunningSessionQuery }],
                variables: {
                  sessionId,
                  settings: {
                    isFeedbackChannelActive: !isFeedbackChannelActive,
                  },
                },
              })
            }}
            handleDeleteFeedback={(feedbackId: string): void => {
              deleteFeedback({
                variables: { feedbackId, sessionId },
              })
            }}
            handlePublicToggle={(): void => {
              updateSettings({
                refetchQueries: [{ query: RunningSessionQuery }],
                variables: {
                  sessionId,
                  settings: {
                    isFeedbackChannelPublic: !isFeedbackChannelPublic,
                  },
                },
              })
            }}
            isActive={isFeedbackChannelActive}
            isPublic={isFeedbackChannelPublic}
            subscribeToMore={(): void => {
              subscribeToMore({
                document: FeedbackAddedSubscription,
                updateQuery: (prev, { subscriptionData }): any => {
                  if (!subscriptionData.data) return prev
                  return {
                    ...prev,
                    runningSession: {
                      ...prev.runningSession,
                      feedbacks: [...prev.runningSession.feedbacks, subscriptionData.data.feedbackAdded],
                    },
                  }
                },
                variables: { sessionId },
              })
            }}
          />
        </div>

        <div className="flex-1 md:pl-4 max-w-[40%]">
          <ConfusionBarometer
            confusionTS={confusionTS}
            handleActiveToggle={(): void => {
              updateSettings({
                refetchQueries: [{ query: RunningSessionQuery }],
                variables: {
                  sessionId,
                  settings: {
                    isConfusionBarometerActive: !isConfusionBarometerActive,
                  },
                },
              })
            }}
            isActive={isConfusionBarometerActive}
            subscribeToMore={(): void => {
              subscribeToMore({
                document: ConfusionAddedSubscription,
                updateQuery: (prev, { subscriptionData }): any => {
                  if (!subscriptionData.data) return prev
                  return {
                    ...prev,
                    runningSession: {
                      ...prev.runningSession,
                      confusionTS: [...prev.runningSession.confusionTS, subscriptionData.data.confusionAdded],
                    },
                  }
                },
                variables: { sessionId },
              })
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default AudienceInteraction
