import { SubscribeToMoreOptions, useMutation } from '@apollo/client'
import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeSessionSettingsDocument,
  ConfusionSummary,
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
import { Switch } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'

import ConfusionCharts from './confusion/ConfusionCharts'
import FeedbackChannel from './feedbacks/FeedbackChannel'
interface Props {
  sessionId: string
  sessionName: string
  confusionValues?: ConfusionSummary
  feedbacks?: Feedback[]
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isModerationEnabled: boolean
  isGamificationEnabled: boolean
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}

function AudienceInteraction({
  sessionId,
  sessionName,
  confusionValues,
  feedbacks,
  isLiveQAEnabled,
  isConfusionFeedbackEnabled,
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
    <div className="flex flex-col justify-between md:flex-row md:flex-wrap">
      <div className="hidden print:block">
        <h1>Session &quot;{sessionName}&quot; - Feedback-Channel</h1>
      </div>

      <div
        className={twMerge(
          'flex flex-col md:justify-start w-full gap-2 md:gap-8 md:flex-row print:hidden'
        )}
      >
        <div className="flex flex-col flex-grow gap-4 md:w-2/3">
          <div className="flex flex-row flex-wrap items-end justify-between">
            <div className="flex text-2xl font-bold">Live Q&A</div>
            <div className="flex flex-row flex-wrap items-end gap-4">
              <Link
                href={`/sessions/${sessionId}/lecturer`}
                target="_blank"
                className="inline-flex items-center gap-1"
              >
                <FontAwesomeIcon icon={faUpRightFromSquare} />
                Dozierendenansicht
              </Link>
              <Switch
                checked={isLiveQAEnabled}
                onCheckedChange={(): void => {
                  changeSessionSettings({
                    variables: {
                      id: sessionId,
                      isLiveQAEnabled: !isLiveQAEnabled,
                    },
                  })
                  push([
                    'trackEvent',
                    'Running Session',
                    !isLiveQAEnabled
                      ? 'Feedback Channel Activated'
                      : 'Feedback Channel Deactivated',
                  ])
                }}
                label="Live Q&A aktivieren"
              />
              <Switch
                checked={isModerationEnabled}
                disabled={!isLiveQAEnabled}
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
                  element: twMerge(!isLiveQAEnabled && 'bg-uzh-grey-40'),
                  label: twMerge(!isLiveQAEnabled && 'text-gray-40'),
                }}
              />
            </div>
          </div>

          {!isLiveQAEnabled && (
            <div className="flex items-center justify-center flex-1 font-bold border rounded">
              Live Q&A nicht aktiv.
            </div>
          )}

          {isLiveQAEnabled && (
            <div className="flex flex-col flex-1 p-4 border rounded md:flex-row md:flex-wrap">
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
                  handlePinFeedback={(
                    feedbackId: number,
                    isPinned: boolean
                  ) => {
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
                      variables: {
                        id: feedbackId,
                        responseContent: response,
                      },
                    })
                    push([
                      'trackEvent',
                      'Running Session',
                      'Feedback Response Added',
                      response.length,
                    ])
                  }}
                  isActive={isLiveQAEnabled}
                  isPublic={!isModerationEnabled}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col md:w-[250px] flex-auto gap-4 md:flex-row md:flex-wrap">
          <div className="flex flex-row flex-wrap items-end justify-between flex-none w-full gap-2">
            <div className="text-2xl font-bold">Feedback</div>
            <Switch
              checked={isConfusionFeedbackEnabled}
              onCheckedChange={(): void => {
                changeSessionSettings({
                  variables: {
                    id: sessionId,
                    isConfusionFeedbackEnabled: !isConfusionFeedbackEnabled,
                  },
                })
                push([
                  'trackEvent',
                  'Running Session',
                  'Feedback Moderation Toggled',
                  String(!isConfusionFeedbackEnabled),
                ])
              }}
              label="Feedback aktivieren"
              className={{
                root: twMerge('items-start'),
              }}
            />
          </div>
          <div className="flex-1 flex-shrink p-4 rounded print:hidden border md:max-h-[31rem]">
            {isConfusionFeedbackEnabled ? (
              // <div className="flex-initial mx-auto md:mt-4 p-4 w-[300px] sm:w-[600px] lg:w-[300px] bg-primary-bg rounded shadow print:hidden border-primary border-solid border md:max-h-[31rem]">
              <ConfusionCharts confusionValues={confusionValues} />
            ) : (
              // </div>
              <div className="flex min-h-[355px] justify-center items-center font-bold">
                Feedback nicht aktiv.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AudienceInteraction
