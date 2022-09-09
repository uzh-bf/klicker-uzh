import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import React from 'react'

interface FeedbackProps {
  feedback: Feedback
  onUpvoteFeedback: (change: number) => void
  onReactToFeedbackResponse: (upvoteChange: number, downvoteChange: number) => void
}

function PublicFeedback({
  feedback,
  onUpvoteFeedback,
  onReactToFeedbackResponse,
}: FeedbackProps): React.ReactElement {
  console.log(feedback)
  // TODO: use localforage to keep track of upvotes and response up-/downvotes
  const votes = {}

  const onUpvote = () => {
    return null
  }

  const onResponseUpvote = () => {
    return null
  }
  const onResponseDownvote = () => {
    return null
  }

  return (
    <div className="w-full mb-2 bg-red-400">
      <div>
        {feedback.content}
        <Button onClick={onUpvote} active={false}>
          <Button.Icon>IC</Button.Icon>
        </Button>
      </div>
      {feedback.responses &&
        feedback.responses.length > 0 &&
        feedback.responses.map((response) => (
          <div key={response?.content}>
            {response?.content}
            <Button onClick={onResponseUpvote} active={false}>
              <Button.Icon>UP</Button.Icon>
            </Button>
            <Button onClick={onResponseDownvote} active={false}>
              <Button.Icon>DN</Button.Icon>
            </Button>
          </div>
        ))}
    </div>
  )
}

export default PublicFeedback
