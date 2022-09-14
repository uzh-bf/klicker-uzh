import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { push } from '@socialgouv/matomo-next'
import { Button, Switch } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

// import DeleteFeedbackMutation from '../../graphql/mutations/DeleteFeedbackMutation.graphql'
// import DeleteFeedbackResponseMutation from '../../graphql/mutations/DeleteFeedbackResponseMutation.graphql'
// import PinFeedbackMutation from '../../graphql/mutations/PinFeedbackMutation.graphql'
// import PublishFeedbackMutation from '../../graphql/mutations/PublishFeedbackMutation.graphql'
// import ResolveFeedbackMutation from '../../graphql/mutations/ResolveFeedbackMutation.graphql'
// import RespondToFeedbackMutation from '../../graphql/mutations/RespondToFeedbackMutation.graphql'
// import UpdateSessionSettingsMutation from '../../graphql/mutations/UpdateSessionSettingsMutation.graphql'
// import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
// import ConfusionAddedSubscription from '../../graphql/subscriptions/ConfusionAddedSubscription.graphql'
// import FeedbackAddedSubscription from '../../graphql/subscriptions/FeedbackAddedSubscription.graphql'
import { useMutation } from '@apollo/client'
import {
  AggregatedConfusionFeedbacks,
  ChangeSessionSettingsDocument,
  DeleteFeedbackDocument,
  DeleteFeedbackResponseDocument,
  Feedback,
  GetCockpitSessionDocument,
  PinFeedbackDocument,
  PublishFeedbackDocument,
  ResolveFeedbackDocument,
  RespondToFeedbackDocument,
} from '@klicker-uzh/graphql/dist/ops'

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
}

function AudienceInteraction({
  sessionId,
  sessionName,
  confusionValues,
  feedbacks,
  isAudienceInteractionActive,
  isModerationEnabled,
  isGamificationEnabled,
}: Props) {
  const [changeSessionSettings] = useMutation(ChangeSessionSettingsDocument)
  const [publishFeedback] = useMutation(PublishFeedbackDocument)
  const [pinFeedback] = useMutation(PinFeedbackDocument)
  const [resolveFeedback] = useMutation(ResolveFeedbackDocument)
  const [deleteFeedback] = useMutation(DeleteFeedbackDocument)
  const [deleteFeedbackResponse] = useMutation(DeleteFeedbackResponseDocument)
  const [respondToFeedback] = useMutation(RespondToFeedbackDocument)

  //   const [deleteFeedback] = useMutation(DeleteFeedbackMutation)
  //   const [pinFeedback] = useMutation(PinFeedbackMutation)
  //   const [publishFeedback] = useMutation(PublishFeedbackMutation)
  //   const [resolveFeedback] = useMutation(ResolveFeedbackMutation)
  //   const [respondToFeedback] = useMutation(RespondToFeedbackMutation)
  //   const [deleteFeedbackResponse] = useMutation(DeleteFeedbackResponseMutation)

  return (
    <div>
      <div className="flex flex-col flex-wrap justify-between gap-4 md:flex-row">
        <div className="text-2xl font-bold print:hidden">
          Publikumsinteraktion
        </div>

        <div className="hidden print:block">
          <h1>Session &quot;{sessionName}&quot; - Feedback-Channel</h1>
        </div>

        <div className="flex flex-col flex-wrap self-start gap-4 md:flex-row print:hidden">
          {isAudienceInteractionActive && (
            <div className="order-3 md:order-1">
              <a
                href={`/sessions/feedbacks`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Button className="h-10 px-4">
                  <Button.Icon>
                    <FontAwesomeIcon icon={faUpRightFromSquare} />
                  </Button.Icon>
                  <Button.Label>Dozierendenansicht</Button.Label>
                </Button>
              </a>
            </div>
          )}

          <div className="flex items-center order-1 md:order-2">
            <Switch
              id="audienceInteraction-switch"
              checked={isAudienceInteractionActive}
              label=""
              onCheckedChange={(): void => {
                changeSessionSettings({
                  refetchQueries: [{ query: GetCockpitSessionDocument }],
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
            />
            Publikumsinteraktion aktivieren
          </div>

          <div className="flex items-center order-2 md:order-3">
            <Switch
              id="moderation-switch"
              checked={isModerationEnabled}
              label=""
              disabled={!isAudienceInteractionActive}
              onCheckedChange={(): void => {
                changeSessionSettings({
                  refetchQueries: [{ query: GetCockpitSessionDocument }],
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
            />
            <span
              className={twMerge(
                !isAudienceInteractionActive && 'text-gray-400'
              )}
            >
              Moderation aktivieren
            </span>
          </div>
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
                isPublic={isModerationEnabled}
              />
            </div>
          </div>

          <div className="flex-initial mx-auto md:mt-4 p-4 w-[300px] sm:w-[600px] lg:w-[300px] bg-primary-bg rounded shadow print:hidden border-primary border-solid border">
            <ConfusionCharts confusionValues={confusionValues} />
          </div>
        </div>
      )}
    </div>
  )
}

export default AudienceInteraction
