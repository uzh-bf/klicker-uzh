import React, { useMemo } from 'react'
import rehypeExternalLinks from 'rehype-external-links'
import katex from 'rehype-katex'
// import rehypePrism from 'rehype-prism-plus'
import rehype2react from 'rehype-react'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import math from 'remark-math'
import markdown from 'remark-parse'
import remark2rehype from 'remark-rehype'
import { twMerge } from 'tailwind-merge'
import { unified } from 'unified'
import ImgWithModal from './ImgWithModal'

export interface MarkdownProps {
  className?: {
    root?: string
    img?: string
  }
  content?: string
  components?: {
    img?: ({
      src,
      alt,
      width,
      height,
    }: {
      src: string
      alt?: string
      width?: number
      height?: number
    }) => React.ReactElement
    [key: string]: any
  }
  withModal?: boolean
}

function Markdown({
  className,
  content = '<br>',
  components = {},
  withModal = true,
}: MarkdownProps): React.ReactElement {
  const parsedContent = useMemo(() => {
    if (content?.length <= 2) {
      return content
    }
    try {
      return (
        unified()
          .use(markdown)
          .use(math, { singleDollarTextMath: false })
          .use(remark2rehype, { allowDangerousHtml: false })
          .use(rehypeSanitize, {
            ...defaultSchema,
            attributes: {
              ...defaultSchema.attributes,
              div: [
                ...(defaultSchema?.attributes?.div || []),
                ['className', 'math', 'math-display'],
              ],
              span: [
                ...(defaultSchema?.attributes?.span || []),
                ['className', 'math', 'math-inline'],
              ],
              img: [
                ...(defaultSchema?.attributes?.img || []),
                ['className', 'src', 'alt'],
              ],
              a: [
                ...(defaultSchema?.attributes?.a || []),
                ['className', 'href', 'target', 'rel'],
              ],
            },
          })
          // .use(rehypePrism)
          .use(rehypeExternalLinks)
          .use(katex, {
            throwOnError: false,
          })
          .use(rehype2react, {
            createElement: React.createElement,
            components: {
              img: ({
                src,
                alt,
                width,
                height,
              }: {
                src: string
                alt?: string
                width?: number
                height?: number
              }) => (
                <ImgWithModal
                  src={src}
                  alt={alt}
                  width={width}
                  height={height}
                  className={{
                    img: className?.img,
                  }}
                  withModal={withModal}
                />
              ),
              ...(components as any),
            },
          })
          .processSync(content).result
      )
    } catch (e) {
      console.error(e)
      return 'Failed to parse content.'
    }
  }, [content])

  return (
    <div className={twMerge('max-w-none', className?.root)}>
      {parsedContent}
    </div>
  )
}

export default Markdown
