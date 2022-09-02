import React from 'react'

interface QuestionAreaProps {
  expiresAt?: Date
  questions: JSON[]
  handleNewResponse: any // TODO: correct typing
  sessionId: string
  timeLimit?: number
  isAuthenticationEnabled?: boolean
  isStaticPreview?: boolean
}

function QuestionArea({
  expiresAt,
  questions,
  handleNewResponse,
  sessionId,
  timeLimit,
  isAuthenticationEnabled,
  isStaticPreview,
}: QuestionAreaProps): React.ReactElement {
  console.log(questions)
  return <div className="w-full h-full">Question Area Component</div>
}

export default QuestionArea
