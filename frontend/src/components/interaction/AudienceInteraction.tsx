import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client'
import { Checkbox, Message, Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import clsx from 'clsx'
import { push } from '@socialgouv/matomo-next'

import ConfusionBarometer from './confusion/ConfusionBarometer'
import FeedbackChannel from './feedbacks/FeedbackChannel'
import DeleteFeedbackMutation from '../../graphql/mutations/DeleteFeedbackMutation.graphql'
import FeedbackAddedSubscription from '../../graphql/subscriptions/FeedbackAddedSubscription.graphql'
import ConfusionAddedSubscription from '../../graphql/subscriptions/ConfusionAddedSubscription.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import UpdateSessionSettingsMutation from '../../graphql/mutations/UpdateSessionSettingsMutation.graphql'
import PinFeedbackMutation from '../../graphql/mutations/PinFeedbackMutation.graphql'
import PublishFeedbackMutation from '../../graphql/mutations/PublishFeedbackMutation.graphql'
import ResolveFeedbackMutation from '../../graphql/mutations/ResolveFeedbackMutation.graphql'
import RespondToFeedbackMutation from '../../graphql/mutations/RespondToFeedbackMutation.graphql'
import DeleteFeedbackResponseMutation from '../../graphql/mutations/DeleteFeedbackResponseMutation.graphql'

interface Props {
  sessionId: string
  sessionName: string
  confusionValues: any
  feedbacks: any[]
  isFeedbackChannelActive: boolean
  isFeedbackChannelPublic: boolean
  isConfusionBarometerActive: boolean
  subscribeToMore: any
  hasConfusionFlag: boolean
}

function AudienceInteraction({
  sessionId,
  sessionName,
  confusionValues,
  feedbacks,
  isFeedbackChannelActive,
  isFeedbackChannelPublic,
  isConfusionBarometerActive,
  subscribeToMore,
  hasConfusionFlag,
}: Props) {
  useEffect(() => {
    return subscribeToMore({
      document: FeedbackAddedSubscription,
      updateQuery: (prev, { subscriptionData }): any => {
        console.warn(prev, subscriptionData)
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
  }, [subscribeToMore, sessionId])

  const [deleteFeedback] = useMutation(DeleteFeedbackMutation)
  const [updateSettings] = useMutation(UpdateSessionSettingsMutation)
  const [pinFeedback] = useMutation(PinFeedbackMutation)
  const [publishFeedback] = useMutation(PublishFeedbackMutation)
  const [resolveFeedback] = useMutation(ResolveFeedbackMutation)
  const [respondToFeedback] = useMutation(RespondToFeedbackMutation)
  const [deleteFeedbackResponse] = useMutation(DeleteFeedbackResponseMutation)

  return (
    <div>
      <div className="flex flex-col flex-wrap justify-between gap-4 md:flex-row">
        <div className="text-2xl font-bold print:hidden">
          <FormattedMessage defaultMessage="Audience Interaction" id="runningSession.title.audienceinteraction" />
        </div>

        <div className="hidden print:block">
          <h1>Session &quot;{sessionName}&quot; - Feedback-Channel</h1>
        </div>

        <div className="flex flex-col flex-wrap self-start gap-4 md:flex-row print:hidden">
          {isFeedbackChannelActive && (
            <div className="order-3 md:order-1">
              <a href={`/sessions/feedbacks`} rel="noopener noreferrer" target="_blank">
                <Button text labelPosition="left" size="small">
                  <Icon name="external" />
                  <FormattedMessage defaultMessage="Pinned Feedbacks" id="runningSession.button.pinnedfeedbacks" />
                </Button>
              </a>
            </div>
          )}

          <div className="flex items-center order-1 md:order-2">
            <Checkbox
              toggle
              checked={isFeedbackChannelActive}
              label=""
              onChange={(): void => {
                updateSettings({
                  refetchQueries: [{ query: RunningSessionQuery }],
                  variables: {
                    sessionId,
                    settings: {
                      isFeedbackChannelActive: !isFeedbackChannelActive,
                      isConfusionBarometerActive: !isConfusionBarometerActive && hasConfusionFlag,
                    },
                  },
                })
                push([
                  'trackEvent',
                  'Running Session',
                  !isFeedbackChannelActive ? 'Feedback Channel Activated' : 'Feedback Channel Deactivated',
                ])
              }}
            />
            <FormattedMessage
              defaultMessage="Enable Audience Interaction"
              id="runningSession.switches.enableaudienceinteraction"
            />
          </div>

          <div className="flex items-center order-2 md:order-3">
            <Checkbox
              toggle
              checked={!isFeedbackChannelPublic}
              disabled={!isFeedbackChannelActive}
              label=""
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
                push(['trackEvent', 'Running Session', 'Feedback Moderation Toggled', String(!isFeedbackChannelPublic)])
              }}
            />
            <span className={clsx(!isFeedbackChannelActive && 'text-gray-400')}>
              <FormattedMessage defaultMessage="Enable Moderation" id="runningSession.switches.enablemoderation" />
            </span>
          </div>
        </div>
      </div>

      {!isFeedbackChannelActive && (
        <Message
          info
          className="print:hidden"
          content={
            <FormattedMessage
              defaultMessage="Enabling audience interaction allows participants to ask questions and to provide you with valuable feedback during your lecture."
              id="runningSession.audienceInteraction.description"
            />
          }
          icon="info"
        />
      )}

      {isFeedbackChannelActive && (
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
          <div className="flex flex-col flex-1 md:flex-row">
            <div className="flex-1">
              <FeedbackChannel
                feedbacks={feedbacks}
                handleDeleteFeedback={(feedbackId: string): void => {
                  deleteFeedback({ variables: { feedbackId, sessionId } })
                  push(['trackEvent', 'Running Session', 'Feedback Deleted'])
                }}
                handleDeleteFeedbackResponse={(feedbackId: string, responseId: string) => {
                  deleteFeedbackResponse({ variables: { sessionId, feedbackId, responseId } })
                  push(['trackEvent', 'Running Session', 'Feedback Response Deleted'])
                }}
                handlePinFeedback={(feedbackId: string, pinState: boolean) => {
                  pinFeedback({ variables: { sessionId, feedbackId, pinState } })
                  push(['trackEvent', 'Running Session', 'Feedback Pinned', String(pinState)])
                }}
                handlePublishFeedback={(feedbackId: string, publishState: boolean) => {
                  publishFeedback({ variables: { sessionId, feedbackId, publishState } })
                  push(['trackEvent', 'Running Session', 'Feedback Published', String(publishState)])
                }}
                handleResolveFeedback={(feedbackId: string, resolvedState: boolean) => {
                  resolveFeedback({ variables: { sessionId, feedbackId, resolvedState } })
                  push(['trackEvent', 'Running Session', 'Feedback Resolved', String(resolvedState)])
                }}
                handleRespondToFeedback={(feedbackId: string, response: string) => {
                  respondToFeedback({ variables: { sessionId, feedbackId, response } })
                  push(['trackEvent', 'Running Session', 'Feedback Response Added', response.length])
                }}
                isActive={isFeedbackChannelActive}
                isPublic={isFeedbackChannelPublic}
              />
            </div>
          </div>

          {hasConfusionFlag && isConfusionBarometerActive && (
            <div className="flex-initial mx-auto md:mt-4 p-4 w-[300px] sm:w-[600px] lg:w-[300px] bg-primary-bg rounded shadow print:hidden border-primary border-solid border">
              <ConfusionBarometer
                confusionValues={confusionValues}
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
                          },
                        },
                      }
                    },
                    variables: { sessionId },
                  })
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AudienceInteraction
