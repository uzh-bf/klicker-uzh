import React from 'react'
import unified from 'unified'
import markdown from 'remark-parse'
import math from 'remark-math'
import remark2rehype from 'remark-rehype'
import rehype2react from 'rehype-react'
import raw from 'rehype-raw'
import katex from 'rehype-katex'

interface Props {
  content: Record<string, any> | string
  description?: string
}

function QuestionDescription({ content, description }: Props): React.ReactElement {
  const parsedContent = content
    ? unified()
        .use(markdown)
        .use(math)
        .use(remark2rehype, { allowDangerousHtml: false })
        .use(katex)
        .use(raw)
        .use(rehype2react, {
          createElement: React.createElement,
        })
        .processSync(content).result
    : description

  return (
    <>
      {/* include katex css sheet in order to ensure correct display and avoid duplicate rendering */}
      <link
        crossOrigin="anonymous"
        href="https://cdn.jsdelivr.net/npm/katex@0.15.2/dist/katex.min.css"
        integrity="sha384-MlJdn/WNKDGXveldHDdyRP1R4CTHr3FeuDNfhsLPYrq2t0UBkUdK2jyTnXPEK1NQ"
        rel="stylesheet"
      />
      <div className="prose-sm prose break-words hyphens-auto max-w-none">{parsedContent}</div>
    </>
  )
}

export default QuestionDescription
