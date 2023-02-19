import { Button, Modal } from '@uzh-bf/design-system'
import Image from 'next/image.js'
import React, { useMemo, useState } from 'react'
import rehypeExternalLinks from 'rehype-external-links'
import katex from 'rehype-katex'
// import rehypePrism from 'rehype-prism-plus'
import rehype2react from 'rehype-react'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import math from 'remark-math'
import markdown from 'remark-parse'
import remark2rehype from 'remark-rehype'
import { unified } from 'unified'

export function ImgWithModal({
  src,
  alt,
  width,
  height,
  ...props
}: {
  src: string
  alt?: string
  width?: number
  height?: number
  [key: string]: any
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Modal
      fullScreen
      open={isOpen}
      trigger={
        <Button basic onClick={() => setIsOpen(true)}>
          <div className="flex flex-col items-start mb-2">
            <Image
              className="border rounded hover:shadow"
              src={src}
              alt="Image"
              width={width ?? 200}
              height={height ?? 200}
            />
            {alt && <div className="text-sm text-slate-500">{alt}</div>}
          </div>
        </Button>
      }
      onClose={() => setIsOpen(false)}
      title={alt}
      {...props}
    >
      <div className="relative w-full h-full">
        <Image src={src} alt="Image" fill className="object-contain" />
      </div>
    </Modal>
  )
}

interface MarkdownProps {
  className?: string
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
  }
}

const defaultProps: MarkdownProps = {
  content: '<br>',
  className: undefined,
  description: 'Description missing',
  components: {
    img: ({ src, alt, width, height }) => (
      <ImgWithModal src={src} alt={alt} width={width} height={height} />
    ),
  },
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

  return <div className={className}>{parsedContent}</div>
}

Markdown.defaultProps = defaultProps
export default Markdown
