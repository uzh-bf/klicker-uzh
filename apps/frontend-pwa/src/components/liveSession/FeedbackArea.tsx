import React from 'react'

interface FeedbackAreaProps {
  feedbacks: any[]
}

function FeedbackArea({ feedbacks }: FeedbackAreaProps): React.ReactElement {
  return <div className="w-full h-full">Feedback Area Component</div>
}

export default FeedbackArea
