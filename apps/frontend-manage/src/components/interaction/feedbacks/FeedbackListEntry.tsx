import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import type { AudienceFeedback } from '../types'
import Feedback from './Feedback'

interface FeedbackListEntryProps {
  feedback: AudienceFeedback
  isPublic?: boolean
  onDeleteFeedback: () => Promise<boolean>
  onDeleteResponse: (responseId: number) => Promise<boolean>
  onPinFeedback: (pinState: boolean) => Promise<boolean>
  onResolveFeedback: (resolvedState: boolean) => Promise<boolean>
  onRespondToFeedback: (response: string) => Promise<boolean>
  onPublishFeedback?: (publishState: boolean) => Promise<boolean>
}

function FeedbackListEntry({
  feedback,
  isPublic = false,
  onDeleteFeedback,
  onDeleteResponse,
  onPinFeedback,
  onResolveFeedback,
  onRespondToFeedback,
  onPublishFeedback,
}: FeedbackListEntryProps) {
  const [publishing, setPublishing] = useState(false)

  async function handlePublishClick() {
    if (publishing || !onPublishFeedback) return

    setPublishing(true)
    try {
      await onPublishFeedback(!feedback.isPublished)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-row gap-2 print:mt-2">
      {!isPublic && onPublishFeedback && (
        <div className="flex-initial print:hidden">
          <Button
            className={{
              root: 'h-9 w-9',
            }}
            disabled={publishing}
            loading={publishing}
            onClick={() => void handlePublishClick()}
            data={{ cy: `publish-feedback-${feedback.content}` }}
          >
            <Button.Icon
              withoutLabel
              icon={feedback.isPublished ? faEye : faEyeSlash}
              className={{ root: 'h-4.5 w-4.5' }}
            />
          </Button>
        </div>
      )}
      <div className="flex-1">
        <Feedback
          id={feedback.id}
          content={feedback.content}
          createdAt={feedback.createdAt}
          pinned={feedback.isPinned}
          resolved={feedback.isResolved}
          resolvedAt={feedback.resolvedAt ?? ''}
          responses={feedback.responses ?? []}
          votes={feedback.votes}
          onDeleteFeedback={onDeleteFeedback}
          onDeleteResponse={onDeleteResponse}
          onPinFeedback={onPinFeedback}
          onResolveFeedback={onResolveFeedback}
          onRespondToFeedback={(id, response) => onRespondToFeedback(response)}
        />
      </div>
    </div>
  )
}

export default FeedbackListEntry
