import { useMutation } from '@apollo/client'
import {
  Feedback,
  UpvoteFeedbackDocument,
  VoteFeedbackResponseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H1, H3 } from '@uzh-bf/design-system'
import React from 'react'
import PublicFeedback from './PublicFeedback'

interface FeedbackAreaProps {
  feedbacks: Feedback[]
  loading?: boolean
  isAudienceInteractionActive?: boolean
  isFeedbackChannelPublic?: boolean
}

const defaultProps = {
  loading: false,
  isAudienceInteractionActive: false,
  isFeedbackChannelPublic: false,
}

function FeedbackArea({
  feedbacks,
  loading,
  isAudienceInteractionActive,
  isFeedbackChannelPublic,
}: FeedbackAreaProps): React.ReactElement {
  const [upvoteFeedback] = useMutation(UpvoteFeedbackDocument)
  const [voteFeedbackResponse] = useMutation(VoteFeedbackResponseDocument)

  const onUpvoteFeedback = (id: number, change: number) => {
    upvoteFeedback({ variables: { feedbackId: id, increment: change } })
  }

  const onReactToFeedbackResponse = (
    id: number,
    upvoteChange: number,
    downvoteChange: number
  ) => {
    voteFeedbackResponse({
      variables: {
        id: id,
        incrementUpvote: upvoteChange,
        incrementDownvote: downvoteChange,
      },
    })
  }

  if (loading || !feedbacks) {
    return <div>Loading...</div>
  }
  const openFeedbacks = feedbacks.filter(
    (feedback) => feedback.isResolved === false
  )
  const resolvedFeedbacks = feedbacks.filter(
    (feedback) => feedback.isResolved === true
  )

  return (
    <div className="w-full h-full">
      <H1>Feedback-Kanal</H1>
      {isAudienceInteractionActive && (
        <div className="mb-8">Feedback Input // TODO</div>
      )}
      {isAudienceInteractionActive && (
        <div className="mb-8">ConfusionArea PLACEHOLDER // TODO</div>
      )}
      {isFeedbackChannelPublic && feedbacks.length > 0 && (
        <div>
          {openFeedbacks.length > 0 && (
            <div className="mb-8">
              <H3>Open Questions</H3>
              {openFeedbacks.map((feedback) => (
                <PublicFeedback
                  key={feedback.content}
                  feedback={feedback}
                  onUpvoteFeedback={onUpvoteFeedback}
                  onReactToFeedbackResponse={onReactToFeedbackResponse}
                />
              ))}
            </div>
          )}

          {resolvedFeedbacks.length > 0 && (
            <div className="mb-4">
              <H3>Resolved Questions</H3>
              {resolvedFeedbacks.map((feedback) => (
                <PublicFeedback
                  key={feedback.content}
                  feedback={feedback}
                  onUpvoteFeedback={onUpvoteFeedback}
                  onReactToFeedbackResponse={onReactToFeedbackResponse}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
