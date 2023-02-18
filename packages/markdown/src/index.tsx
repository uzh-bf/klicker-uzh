import { Button, Modal } from '@uzh-bf/design-system'
import Image from 'next/image.js'
import React, { useMemo, useState } from 'react'
import rehypeExternalLinks from 'rehype-external-links'
import katex from 'rehype-katex'
// import rehypePrism from 'rehype-prism-plus'
import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import rehype2react from 'rehype-react'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import math from 'remark-math'
import markdown from 'remark-parse'
import remark2rehype from 'remark-rehype'
import { twMerge } from 'tailwind-merge'
import { unified } from 'unified'

export function ImgWithModal({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string
  alt?: string
  width?: number
  height?: number
  className?: {
    modal?: string
    img?: string
  }
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Modal
      fullScreen
      open={isOpen}
      trigger={
        <div className="flex flex-col items-start mb-1">
          <div className="relative">
            <Image
              src={src}
              alt="Image"
              height="0"
              width="0"
              className={twMerge(
                'object-contain w-auto min-h-36 max-h-64 rounded shadow',
                className?.img
              )}
              style={{ width, height }}
              sizes="100vw"
            />
            <Button
              className={{
                root: 'absolute top-2 right-2 text-sm',
              }}
              onClick={() => setIsOpen(true)}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faExpand} />
              </Button.Icon>
            </Button>
          </div>
          {alt && <div className="text-sm text-slate-600">{alt}</div>}
        </div>
      }
      onClose={() => setIsOpen(false)}
      title={alt}
      className={{ content: className?.modal }}
    >
      <div className="relative w-full h-full">
        <Image src={src} alt="Image" fill className="object-contain" />
      </div>
    </Modal>
  )
}

interface MarkdownProps {
  className?: {
    root?: string
    img?: string
  }
  content: any
  description?: string
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
}

const defaultProps: MarkdownProps = {
  content: '<br>',
  className: undefined,
  description: 'Description missing',
  components: {},
}

function Markdown({
  className,
  content,
  description,
  components,
}: MarkdownProps): React.ReactElement {
  const parsedContent = useMemo(() => {
    if (content?.length <= 2) {
      return content
    }
    try {
      return content
        ? unified()
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
                  />
                ),
                ...(components as any),
              },
            })
            .processSync(content).result
        : description
    } catch (e) {
      console.error(e)
      return content
    }
  }, [content, description])

  return <div className={className?.root}>{parsedContent}</div>
}

Markdown.defaultProps = defaultProps
export default Markdown
