import React, { useMemo } from 'react'
import unified from 'unified'
import markdown from 'remark-parse'
import math from 'remark-math'
import remark2rehype from 'remark-rehype'
import rehype2react from 'rehype-react'
// import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import katex from 'rehype-katex'

interface Params {
  content: any
  description?: string
}

function useMarkdown({ content, description }: Params) {
  const parsedContent = useMemo(() => {
    try {
      return content
        ? unified()
            .use(markdown)
            .use(math)
            .use(remark2rehype, { allowDangerousHtml: false })
            // https://github.com/rehypejs/rehype-sanitize
            // .use(rehypeSanitize, {
            //   ...defaultSchema,
            //   attributes: {
            //     ...defaultSchema.attributes,
            //     div: [...(defaultSchema.attributes.div || []), ['className', 'math', 'math-display']],
            //     span: [...(defaultSchema.attributes.span || []), ['className', 'math', 'math-inline']],
            //   },
            // })
            .use(katex)
            .use(rehype2react, {
              createElement: React.createElement,
            })
            .processSync(content).result
        : description
    } catch (e) {
      return content
    }
  }, [content, description])

  return parsedContent
}

export default useMarkdown
