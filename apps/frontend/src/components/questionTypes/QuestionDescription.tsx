import React from 'react'
import Head from 'next/head'

import useMarkdown from '../../lib/hooks/useMarkdown'

interface Props {
  content: Record<string, any> | string
  description?: string
}

function QuestionDescription({ content, description }: Props): React.ReactElement {
  const parsedContent = useMarkdown({ content, description })

  return (
    <>
      {/* include katex css sheet in order to ensure correct display and avoid duplicate rendering */}
      <Head>
        <link
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/npm/katex@0.15.2/dist/katex.min.css"
          integrity="sha384-MlJdn/WNKDGXveldHDdyRP1R4CTHr3FeuDNfhsLPYrq2t0UBkUdK2jyTnXPEK1NQ"
          rel="stylesheet"
        />
      </Head>

      <div className="prose-sm prose break-words hyphens-auto max-w-none">{parsedContent}</div>

      <style global jsx>{`
        .katex {
          font-size: 1.6em !important;
        }
      `}</style>
    </>
  )
}

export default QuestionDescription
