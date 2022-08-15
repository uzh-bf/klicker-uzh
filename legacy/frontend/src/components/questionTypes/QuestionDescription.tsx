import React from 'react'

import useMarkdown from '../../lib/hooks/useMarkdown'

interface Props {
  content: Record<string, any> | string
  description?: string
}

function QuestionDescription({ content, description }: Props): React.ReactElement {
  const parsedContent = useMarkdown({ content, description })

  return (
    <>
      <div className="prose-sm prose break-words hyphens-auto max-w-none">{parsedContent}</div>

      <style global jsx>{`
        .katex {
          font-size: 1.1rem;
        }
      `}</style>
    </>
  )
}

export default QuestionDescription
