import { SubscribeToMoreOptions, useMutation } from '@apollo/client'
import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AggregatedConfusionFeedbacks,
  ChangeSessionSettingsDocument,
  DeleteFeedbackDocument,
  DeleteFeedbackResponseDocument,
  Feedback,
  FeedbackCreatedDocument,
  PinFeedbackDocument,
  PublishFeedbackDocument,
  ResolveFeedbackDocument,
  RespondToFeedbackDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { push } from '@socialgouv/matomo-next'
import { Button, Switch } from '@uzh-bf/design-system'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'

import ConfusionCharts from './confusion/ConfusionCharts'
import FeedbackChannel from './feedbacks/FeedbackChannel'
interface Props {
  sessionId: string
  sessionName: string
  confusionValues?: AggregatedConfusionFeedbacks
  feedbacks?: Feedback[]
  isAudienceInteractionActive: boolean
  isModerationEnabled: boolean
  isGamificationEnabled: boolean
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}

function AudienceInteraction({
  sessionId,
  sessionName,
  confusionValues,
  feedbacks,
  isAudienceInteractionActive,
  isModerationEnabled,
  isGamificationEnabled,
  subscribeToMore,
}: Props) {
  useEffect(() => {
    if (!sessionId) return

    const feedbackAdded = subscribeToMore({
      document: FeedbackCreatedDocument,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        const newItem = subscriptionData.data.feedbackCreated
        return {
          ...prev,
          feedbacks: [newItem, ...prev.cockpitSession.feedbacks],
        }
      },
    })

    return () => {
      feedbackAdded && feedbackAdded()
    }
  }, [subscribeToMore, sessionId])

  const [changeSessionSettings] = useMutation(ChangeSessionSettingsDocument)
  const [publishFeedback] = useMutation(PublishFeedbackDocument)
  const [pinFeedback] = useMutation(PinFeedbackDocument)
  const [resolveFeedback] = useMutation(ResolveFeedbackDocument)
  const [deleteFeedback] = useMutation(DeleteFeedbackDocument)
  const [deleteFeedbackResponse] = useMutation(DeleteFeedbackResponseDocument)
  const [respondToFeedback] = useMutation(RespondToFeedbackDocument)

  return (
    <div>
      <div className="flex flex-col flex-wrap justify-between gap-4 md:flex-row">
        <div className="hidden print:block">
          <h1>Session &quot;{sessionName}&quot; - Feedback-Channel</h1>
        </div>

        <div
          className={twMerge(
            'flex flex-col justify-end w-full gap-2 md:gap-8 md:flex-row print:hidden h-8',
            isAudienceInteractionActive && 'justify-between'
          )}
        >
          {isAudienceInteractionActive && (
            <div className="text-2xl font-bold">Publikumsinteraktion</div>
          )}
          <div className="flex flex-row gap-8">
            <Switch
              checked={isAudienceInteractionActive}
              onCheckedChange={(): void => {
                changeSessionSettings({
                  variables: {
                    id: sessionId,
                    isAudienceInteractionActive: !isAudienceInteractionActive,
                    isModerationEnabled: !isAudienceInteractionActive
                      ? isModerationEnabled
                      : false,
                  },
                })
                push([
                  'trackEvent',
                  'Running Session',
                  !isAudienceInteractionActive
                    ? 'Feedback Channel Activated'
                    : 'Feedback Channel Deactivated',
                ])
              }}
              label="Publikumsinteraktion aktivieren"
            />
            <Switch
              checked={isModerationEnabled}
              disabled={!isAudienceInteractionActive}
              onCheckedChange={(): void => {
                changeSessionSettings({
                  variables: {
                    id: sessionId,
                    isModerationEnabled: !isModerationEnabled,
                  },
                })
                push([
                  'trackEvent',
                  'Running Session',
                  'Feedback Moderation Toggled',
                  String(!isModerationEnabled),
                ])
              }}
              label="Moderation aktivieren"
              className={{
                label: twMerge(!isAudienceInteractionActive && 'text-gray-400'),
              }}
            />
          </div>
        </div>

        <div className="flex flex-col flex-wrap self-start w-full gap-4 md:flex-row print:hidden">
          {isAudienceInteractionActive && (
            <div className="order-3 md:order-1">
              <a
                href={`/sessions/${sessionId}/lecturer`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Button className={{ root: 'h-10 px-4' }}>
                  <Button.Icon className={{ root: 'mr-1' }}>
                    <FontAwesomeIcon icon={faUpRightFromSquare} />
                  </Button.Icon>
                  <Button.Label>Dozierendenansicht</Button.Label>
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>

      {isAudienceInteractionActive && (
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
          <div className="flex flex-col flex-1 md:flex-row">
            <div className="flex-1">
              <FeedbackChannel
                feedbacks={feedbacks}
                handleDeleteFeedback={(feedbackId: number): void => {
                  deleteFeedback({ variables: { id: feedbackId } })
                  push(['trackEvent', 'Running Session', 'Feedback Deleted'])
                }}
                handleDeleteFeedbackResponse={(responseId: number) => {
                  deleteFeedbackResponse({
                    variables: { id: responseId },
                  })
                  push([
                    'trackEvent',
                    'Running Session',
                    'Feedback Response Deleted',
                  ])
                }}
                handlePinFeedback={(feedbackId: number, isPinned: boolean) => {
                  pinFeedback({
                    variables: { id: feedbackId, isPinned: isPinned },
                  })
                  push([
                    'trackEvent',
                    'Running Session',
                    'Feedback Pinned',
                    String(isPinned),
                  ])
                }}
                handlePublishFeedback={(
                  feedbackId: number,
                  isPublished: boolean
                ) => {
                  publishFeedback({
                    variables: { id: feedbackId, isPublished: isPublished },
                  })
                  push([
                    'trackEvent',
                    'Running Session',
                    'Feedback Published',
                    String(isPublished),
                  ])
                }}
                handleResolveFeedback={(
                  feedbackId: number,
                  isResolved: boolean
                ) => {
                  resolveFeedback({
                    variables: { id: feedbackId, isResolved: isResolved },
                  })
                  push([
                    'trackEvent',
                    'Running Session',
                    'Feedback Resolved',
                    String(isResolved),
                  ])
                }}
                handleRespondToFeedback={(
                  feedbackId: number,
                  response: string
                ) => {
                  respondToFeedback({
                    variables: { id: feedbackId, responseContent: response },
                  })
                  push([
                    'trackEvent',
                    'Running Session',
                    'Feedback Response Added',
                    response.length,
                  ])
                }}
                isActive={isAudienceInteractionActive}
                isPublic={!isModerationEnabled}
              />
            </div>
          </div>

          <div className="flex-initial mx-auto md:mt-4 p-4 w-[300px] sm:w-[600px] lg:w-[300px] bg-primary-bg rounded shadow print:hidden border-primary border-solid border md:max-h-[31rem]">
            <ConfusionCharts confusionValues={confusionValues} />
          </div>
        </div>
      )}
    </div>
  )
}

export default AudienceInteraction
