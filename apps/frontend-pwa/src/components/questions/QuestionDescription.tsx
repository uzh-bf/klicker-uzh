import React from 'react'

import useMarkdown from '../../lib/hooks/useMarkdown'

interface Props {
  content: Record<string, any> | string
  description?: string
}

function QuestionDescription({
  content,
  description,
}: Props): React.ReactElement {
  const parsedContent = useMarkdown({ content, description })

  // TODO: investigate if it is possible to move markdown parsing to server (lower resource requirements for clients with PWA)
  return (
    <div className="prose-sm prose break-words hyphens-auto max-w-none">
      {parsedContent}
    </div>
  )
}

export default QuestionDescription
