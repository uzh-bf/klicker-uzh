import { useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { Checkbox, Message, Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import clsx from 'clsx'
import { push } from '@socialgouv/matomo-next'

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
  sessionName: string
  confusionTS: any[]
  feedbacks: any[]
  isFeedbackChannelActive: boolean
  isFeedbackChannelPublic: boolean
  isConfusionBarometerActive: boolean
  subscribeToMore: any
}

function AudienceInteraction({
  sessionId,
  sessionName,
  confusionTS,
  feedbacks,
  isFeedbackChannelActive,
  isFeedbackChannelPublic,
  isConfusionBarometerActive,
  subscribeToMore,
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
        <div className="text-2xl font-bold print:hidden">
          <FormattedMessage defaultMessage="Audience Interaction" id="runningSession.title.audienceinteraction" />
        </div>
        <div className="hidden print:block">
          <h1>Session &quot;{sessionName}&quot; - Feedback-Channel</h1>
        </div>
        <div className="flex items-center mr-2 print:hidden">
          {isFeedbackChannelActive && (
            <a className="mr-10" href={`/sessions/feedbacks`} rel="noopener noreferrer" target="_blank">
              <Button icon labelPosition="left" size="small">
                <Icon name="external" />
                <FormattedMessage defaultMessage="Pinned Feedbacks" id="runningSession.button.pinnedfeedbacks" />
              </Button>
            </a>
          )}

          <div className="inline-block float-bottom">
            <span className="flex">
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
                      },
                    },
                  })
                  push(['trackEvent', 'Running Session', 'Toggled Feedback Channel', String(!isFeedbackChannelActive)])
                }}
              />
              <FormattedMessage
                defaultMessage="Enable Audience Interaction"
                id="runningSession.switches.enableaudienceinteraction"
              />
            </span>
          </div>
          <div className="inline-block float-bottom">
            <span className="flex">
              <Checkbox
                toggle
                checked={!isFeedbackChannelPublic}
                className="ml-8"
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
                  push([
                    'trackEvent',
                    'Running Session',
                    'Toggled Feedback Moderation',
                    String(!isFeedbackChannelPublic),
                  ])
                }}
              />
              <div className={clsx(!isFeedbackChannelActive && 'text-gray-400')}>
                <FormattedMessage defaultMessage="Enable Moderation" id="runningSession.switches.enablemoderation" />
              </div>
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
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 mb-8 md:mb-0">
            <FeedbackChannel
              feedbacks={feedbacks}
              handleActiveToggle={() => null}
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
