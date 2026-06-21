import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { AudienceFeedback } from '../types'
import FeedbackListEntry from './FeedbackListEntry'

interface FeedbackListProps {
  feedbacks: AudienceFeedback[]
  noFeedbacks: boolean
  isPublic?: boolean
  handleDeleteFeedback: (feedbackId: number) => Promise<boolean>
  handlePinFeedback: (feedbackId: number, isPinned: boolean) => Promise<boolean>
  handlePublishFeedback?: (
    feedbackId: number,
    isPublished: boolean
  ) => Promise<boolean>
  handleResolveFeedback: (
    feedbackId: number,
    resolvedState: boolean
  ) => Promise<boolean>
  handleRespondToFeedback: (
    feedbackId: number,
    response: string
  ) => Promise<boolean>
  handleDeleteFeedbackResponse: (responseId: number) => Promise<boolean>
}

function FeedbackList({
  feedbacks,
  noFeedbacks,
  isPublic = false,
  handleDeleteFeedback,
  handlePinFeedback,
  handlePublishFeedback,
  handleResolveFeedback,
  handleRespondToFeedback,
  handleDeleteFeedbackResponse,
}: FeedbackListProps) {
  const t = useTranslations()

  if (noFeedbacks) {
    return (
      <UserNotification
        data={{ cy: 'no-feedbacks-message' }}
        className={{ root: 'text-base' }}
      >
        {t('manage.cockpit.noFeedbacksYet')}
      </UserNotification>
    )
  }

  if (feedbacks.length === 0) {
    return (
      <UserNotification
        data={{ cy: 'no-feedbacks-filtered-message' }}
        className={{ root: 'text-base' }}
      >
        {t('manage.cockpit.noFeedbackFilterMatch')}
      </UserNotification>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {feedbacks.map((feedback) => (
        <FeedbackListEntry
          key={`feedback-list-entry-${feedback.id}`}
          feedback={feedback}
          isPublic={isPublic}
          onDeleteFeedback={() => handleDeleteFeedback(feedback.id)}
          onDeleteResponse={handleDeleteFeedbackResponse}
          onPinFeedback={(pinState: boolean) =>
            handlePinFeedback(feedback.id, pinState)
          }
          onResolveFeedback={(resolvedState: boolean) =>
            handleResolveFeedback(feedback.id, resolvedState)
          }
          onRespondToFeedback={(response: string) =>
            handleRespondToFeedback(feedback.id, response)
          }
          onPublishFeedback={
            handlePublishFeedback
              ? (publishState: boolean) =>
                  handlePublishFeedback(feedback.id, publishState)
              : undefined
          }
        />
      ))}
    </div>
  )
}

export default FeedbackList
