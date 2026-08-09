import { faFileExcel, faFilePdf } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useMemo } from 'react'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
// import rehypePrism from 'rehype-prism-plus'
import rehypeReact from 'rehype-react'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
// import remarkDirective from 'remark-directive'
// import remarkGfm from 'remark-gfm'
import * as runtime from 'react/jsx-runtime'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { twMerge } from 'tailwind-merge'
import { unified } from 'unified'
import ImgWithModal from './ImgWithModal.js'
import { VideoEmbed } from './VideoEmbed.js'
import { parseVideoEmbedUrl } from './VideoEmbedUrl.js'

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
  singleDollarTextMath?: boolean
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
  singleDollarTextMath = false,
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
          .use(remarkParse)
          .use(remarkMath, { singleDollarTextMath })
          // .use(remarkGfm)
          // .use(remarkDirective)
          .use(remarkRehype, { allowDangerousHtml: false })
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
          .use(rehypeKatex)
          .use(rehypeReact, {
            ...runtime,
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
              a: ({
                href,
                children,
                target,
                rel,
                ...rest
              }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
                const labelText =
                  typeof children === 'string'
                    ? children.trim().toLowerCase()
                    : ''
                const isVideoLabel =
                  labelText === 'video' || labelText === 'embed'
                const video =
                  href && isVideoLabel ? parseVideoEmbedUrl(href) : null

                if (video) {
                  return <VideoEmbed {...video} />
                }

                if (withLinkButtons) {
                  const isExcel = href?.includes('.xls')
                  const isPDF = href?.includes('.pdf')
                  return (
                    <a
                      className={twMerge(
                        'my-1 flex flex-row gap-3 rounded-sm border px-4 py-3 text-sm hover:bg-slate-200'
                      )}
                      href={href}
                      target={target}
                      rel={rel}
                      {...rest}
                    >
                      <span>
                        {isExcel && <FontAwesomeIcon icon={faFileExcel} />}
                        {isPDF && <FontAwesomeIcon icon={faFilePdf} />}
                      </span>
                      <span>{children}</span>
                    </a>
                  )
                }

                return (
                  <a href={href} target={target} rel={rel} {...rest}>
                    {children}
                  </a>
                )
              },
              ...components,
            },
          })
          .processSync(contentUnescaped).result
      )
    } catch (e) {
      console.error(e)
      return 'Failed to parse content.'
    }
  }, [
    className?.img,
    components,
    content,
    singleDollarTextMath,
    withLinkButtons,
    withModal,
  ])

  if (withProse) {
    // sizes available: prose-sm, prose-base, prose-lg, prose-xl, prose-2xl
    return (
      <div
        data-cy={data?.cy}
        data-test={data?.test}
        className={twMerge(
          'prose prose-p:mt-0 prose-heading:mt-0 hover:prose-a:text-primary-100 max-w-none',
          className?.root
        )}
      >
        {parsedContent}
      </div>
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
