import { useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { Checkbox, Message } from 'semantic-ui-react'

// import ConfusionBarometer from './confusion/ConfusionBarometer'
import FeedbackChannel from './feedbacks/FeedbackChannel'
import DeleteFeedbackMutation from '../../graphql/mutations/DeleteFeedbackMutation.graphql'
import FeedbackAddedSubscription from '../../graphql/subscriptions/FeedbackAddedSubscription.graphql'
// import ConfusionAddedSubscription from '../../graphql/subscriptions/ConfusionAddedSubscription.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import UpdateSessionSettingsMutation from '../../graphql/mutations/UpdateSessionSettingsMutation.graphql'
import PinFeedbackMutation from '../../graphql/mutations/PinFeedbackMutation.graphql'
import PublishFeedbackMutation from '../../graphql/mutations/PublishFeedbackMutation.graphql'
import ResolveFeedbackMutation from '../../graphql/mutations/ResolveFeedbackMutation.graphql'
import RespondToFeedbackMutation from '../../graphql/mutations/RespondToFeedbackMutation.graphql'
import DeleteFeedbackResponseMutation from '../../graphql/mutations/DeleteFeedbackResponseMutation.graphql'

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
  const [pinFeedback, { loading: isPinFeedbackLoading }] = useMutation(PinFeedbackMutation)
  const [publishFeedback, { loading: isPublishFeedbackLoading }] = useMutation(PublishFeedbackMutation)
  const [resolveFeedback, { loading: isResolveFeedbackLoading }] = useMutation(ResolveFeedbackMutation)
  const [respondToFeedback, { loading: isRespondToFeedbackLoading }] = useMutation(RespondToFeedbackMutation)
  const [deleteFeedbackResponse, { loading: isDeleteFeedbackResponseLoading }] =
    useMutation(DeleteFeedbackResponseMutation)

  return (
    <div>
      <div className="flex flex-row justify-between">
        <div className="text-2xl font-bold">Audience Interaction</div>
        <div className="mr-2">
          <Checkbox
            toggle
            checked={isFeedbackChannelActive}
            label="Enable Audience Interaction"
            onChange={(): void => {
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
          />
          <Checkbox
            toggle
            checked={!isFeedbackChannelPublic}
            className="ml-8"
            disabled={!isFeedbackChannelActive}
            label="Enable Moderation"
            onChange={(): void => {
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
          />
        </div>
      </div>

      {!isFeedbackChannelActive && (
        <Message
          info
          content="Enabling audience interaction allows participants to ask questions and to provide you with valuable feedback during your lecture."
          icon="info"
        />
      )}

      {isFeedbackChannelActive && (
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 mb-8 md:mb-0">
            <FeedbackChannel
              feedbacks={feedbacks}
              handleActiveToggle={() => null}
              handleDeleteFeedback={(feedbackId: string): void => {
                deleteFeedback({ variables: { feedbackId, sessionId } })
              }}
              handleDeleteFeedbackResponse={(feedbackId: string, responseId: string) => {
                deleteFeedbackResponse({ variables: { sessionId, feedbackId, responseId } })
              }}
              handlePinFeedback={(feedbackId: string, pinState: boolean) => {
                pinFeedback({ variables: { sessionId, feedbackId, pinState } })
              }}
              handlePublicToggle={(): void => {
                updateSettings({
                  variables: {
                    sessionId,
                    settings: { isFeedbackChannelPublic: !isFeedbackChannelPublic },
                  },
                })
              }}
              handlePublishFeedback={(feedbackId: string, publishState: boolean) => {
                publishFeedback({ variables: { sessionId, feedbackId, publishState } })
              }}
              handleResolveFeedback={(feedbackId: string, resolvedState: boolean) => {
                resolveFeedback({ variables: { sessionId, feedbackId, resolvedState } })
              }}
              handleRespondToFeedback={(feedbackId: string, response: string) => {
                respondToFeedback({ variables: { sessionId, feedbackId, response } })
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

          {/* <div className="flex-1 md:pl-4 max-w-[40%]">
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
        </div> */}
        </div>
      )}
    </div>
  )
}

export default AudienceInteraction
