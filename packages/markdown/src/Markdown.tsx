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
import {
  VideoEmbed,
  getKalturaId,
  getKalturaPartnerId,
  getKalturaUiConfId,
  getYoutubeId,
} from './VideoEmbed.js'

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

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

type VideoProvider = 'youtube' | 'kaltura'

interface VideoEmbedComponentProps {
  provider?: string
  videoId?: string
  partnerId?: string
  uiConfId?: string
}

function isElement(node: HastNode, tagName: string): boolean {
  return node.type === 'element' && node.tagName === tagName
}

function isWhitespaceText(node: HastNode): boolean {
  return node.type === 'text' && !node.value?.trim()
}

function getPlainText(node: HastNode): string | null {
  if (!node.children) {
    return ''
  }

  let text = ''
  for (const child of node.children) {
    if (child.type !== 'text') {
      return null
    }
    text += child.value ?? ''
  }

  return text
}

function getVideoEmbedProperties(
  anchor: HastNode
): Record<string, string> | null {
  const labelText = getPlainText(anchor)?.trim().toLowerCase()
  if (labelText !== 'video' && labelText !== 'embed') {
    return null
  }

  const href = anchor.properties?.href
  if (typeof href !== 'string') {
    return null
  }

  const youtubeId = getYoutubeId(href)
  if (youtubeId) {
    return {
      provider: 'youtube',
      videoId: youtubeId,
    }
  }

  const kalturaId = getKalturaId(href)
  if (!kalturaId) {
    return null
  }

  return {
    provider: 'kaltura',
    videoId: kalturaId,
    partnerId: getKalturaPartnerId(href),
    uiConfId: getKalturaUiConfId(href),
  }
}

function replaceVideoEmbedParagraphs(node: HastNode): void {
  if (!node.children) {
    return
  }

  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index]
    if (!child) {
      continue
    }

    if (isElement(child, 'p') && child.children) {
      const meaningfulChildren = child.children.filter(
        (paragraphChild) => !isWhitespaceText(paragraphChild)
      )
      const onlyChild = meaningfulChildren[0]

      if (
        meaningfulChildren.length === 1 &&
        onlyChild &&
        isElement(onlyChild, 'a')
      ) {
        const embedProperties = getVideoEmbedProperties(onlyChild)

        if (embedProperties) {
          node.children[index] = {
            type: 'element',
            tagName: 'video-embed',
            properties: embedProperties,
            children: [],
          }
          continue
        }
      }
    }

    replaceVideoEmbedParagraphs(child)
  }
}

function rehypeVideoEmbeds() {
  return (tree: HastNode): void => {
    replaceVideoEmbedParagraphs(tree)
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
          .use(rehypeVideoEmbeds)
          .use(rehypeKatex)
          .use(rehypeReact, {
            ...runtime,
            components: {
              'video-embed': ({
                provider,
                videoId,
                partnerId,
                uiConfId,
              }: VideoEmbedComponentProps) => {
                if (
                  !videoId ||
                  (provider !== 'youtube' && provider !== 'kaltura')
                ) {
                  return null
                }

                return (
                  <VideoEmbed
                    provider={provider as VideoProvider}
                    videoId={videoId}
                    partnerId={partnerId}
                    uiConfId={uiConfId}
                  />
                )
              },
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
                      <div>
                        {isExcel && <FontAwesomeIcon icon={faFileExcel} />}
                        {isPDF && <FontAwesomeIcon icon={faFilePdf} />}
                      </div>
                      <div>{children}</div>
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
  }, [content, singleDollarTextMath])

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
