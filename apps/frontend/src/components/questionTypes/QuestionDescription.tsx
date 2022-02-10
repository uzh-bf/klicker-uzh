import React from 'react'

interface Props {
  content: Record<string, any> | string
  description?: string
}

function QuestionDescription({ content, description }: Props): React.ReactElement {
  // create preview of question
  return <div className="prose-sm prose break-words hyphens-auto max-w-none">TODO</div>
}

export default QuestionDescription
