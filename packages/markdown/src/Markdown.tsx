import { faFileExcel, faFilePdf } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useMemo } from 'react'
import rehypeExternalLinks from 'rehype-external-links'
import katex from 'rehype-katex'
// import rehypePrism from 'rehype-prism-plus'
import { Prose } from '@uzh-bf/design-system'
import rehype2react from 'rehype-react'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import math from 'remark-math'
import markdown from 'remark-parse'
import remark2rehype from 'remark-rehype'
import { twMerge } from 'tailwind-merge'
import { unified } from 'unified'
import ImgWithModal from './ImgWithModal.js'

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
  withLinkButtons?: boolean
  withProse?: boolean
  data?: {
    cy?: string
    test?: string
  }
}

function Markdown({
  className,
  content = '<br>',
  components = {},
  withModal = true,
  withLinkButtons = true,
  withProse = false,
  data,
}: MarkdownProps): React.ReactElement {
  const parsedContent = useMemo(() => {
    if (content?.length <= 2) {
      return content
    }
    try {
      const contentUnescaped = content
        .replace(
          /&amp;|&lt;|&gt;|&#39;|&quot;/g,
          (tag) =>
            ({
              '&amp;': '&',
              '&lt;': '<',
              '&gt;': '>',
              '&#39;': "'",
              '&quot;': '"',
            })[tag] || tag
        )
        .replace(/<br>/g, '&nbsp;')

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
          .use(rehypeExternalLinks, {
            target: '_blank',
            rel: ['noopener', 'noreferrer', 'nofollow'],
          })
          .use(katex)
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
              a: withLinkButtons
                ? ({
                    href,
                    children,
                  }: {
                    href: string
                    children: React.ReactNode
                  }) => {
                    const isExcel = href.includes('.xls')
                    const isPDF = href.includes('.pdf')
                    return (
                      <a
                        className={twMerge(
                          'my-1 flex flex-row gap-3 rounded border px-4 py-3 text-sm hover:bg-slate-200'
                        )}
                        href={href}
                      >
                        <div>
                          {isExcel && <FontAwesomeIcon icon={faFileExcel} />}
                          {isPDF && <FontAwesomeIcon icon={faFilePdf} />}
                        </div>
                        <div>{children}</div>
                      </a>
                    )
                  }
                : 'a',
              ...components,
            },
          })
          .processSync(contentUnescaped).result
      )
    } catch (e) {
      console.error(e)
      return 'Failed to parse content.'
    }
  }, [content])

  if (withProse) {
    return (
      <Prose
        className={{
          root: twMerge('prose-p:mt-0 max-w-none', className?.root),
        }}
        data={data}
      >
        {parsedContent}
      </Prose>
    )
  }

  return (
    <div
      className={twMerge('max-w-none', className?.root)}
      data-cy={data?.cy}
      data-test={data?.test}
    >
      {parsedContent}
    </div>
  )
}

export default Markdown
