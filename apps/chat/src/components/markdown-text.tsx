'use client'

import '@assistant-ui/react-markdown/styles/dot.css'

import { useMessagePartText } from '@assistant-ui/react'
import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from '@assistant-ui/react-markdown'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FC, memo, useCallback, useState } from 'react'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import {
  parseCitationHref,
  remarkCitationMarkers,
} from '../lib/markdown/remarkCitationMarkers'
import {
  hideIncompleteMath,
  inspectStreamingMath,
} from '../lib/markdown/streamingMath'
import { cn } from '../lib/utils/ui'
import { CitationChip } from './citation-chip'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

// Stable module-scope reference: recreating this array on every render would
// defeat `MarkdownTextPrimitive`'s own memoization of the parsed tree.
const remarkPlugins = [remarkGfm, remarkMath, remarkCitationMarkers]
const rehypePlugins = [rehypeKatex]

const MarkdownTextImpl = () => {
  const { text, status } = useMessagePartText()
  const isRunning = status.type === 'running'
  const { hasMathOpener } = inspectStreamingMath(text)
  const preprocess = useCallback(
    (input: string) =>
      normalizeCustomMathTags(isRunning ? hideIncompleteMath(input) : input),
    [isRunning]
  )

  return (
    <MarkdownTextPrimitive
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      preprocess={preprocess}
      smooth={isRunning && !hasMathOpener}
      className="aui-md"
      components={defaultComponents}
    />
  )
}

export const MarkdownText = memo(MarkdownTextImpl)

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const t = useTranslations()
  const { isCopied, copyToClipboard } = useCopyToClipboard()
  const onCopy = () => {
    if (!code || isCopied) return
    copyToClipboard(code)
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-t-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
      <span className="lowercase [&>span]:text-xs">{language}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onCopy}
            className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
          >
            {!isCopied && <CopyIcon />}
            {isCopied && <CheckIcon />}
            <span className="sr-only">{t('chat.markdown.copyCode')}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('chat.markdown.copyCode')}</TooltipContent>
      </Tooltip>
    </div>
  )
}

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const copyToClipboard = (value: string) => {
    if (!value) return

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), copiedDuration)
    })
  }

  return { isCopied, copyToClipboard }
}

const defaultComponents = memoizeMarkdownComponents({
  // Shift Markdown headings down one level because the chatbot shell owns the
  // page's h1. The smaller scale keeps answer structure readable without
  // making a chat bubble look like a document title page.
  h1: ({ className, ...props }) => (
    <h2
      className={cn(
        'mb-4 scroll-m-20 text-2xl font-extrabold tracking-tight text-pretty last:mb-0 sm:text-3xl',
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h3
      className={cn(
        'mb-4 mt-6 scroll-m-20 text-xl font-semibold tracking-tight text-pretty first:mt-0 last:mb-0 sm:text-2xl',
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h4
      className={cn(
        'mb-3 mt-5 scroll-m-20 text-lg font-semibold tracking-tight text-pretty first:mt-0 last:mb-0 sm:text-xl',
        className
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h5
      className={cn(
        'mb-3 mt-4 scroll-m-20 text-base font-semibold tracking-tight text-pretty first:mt-0 last:mb-0 sm:text-lg',
        className
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h6
      className={cn(
        'my-3 text-[15px] font-semibold text-pretty first:mt-0 last:mb-0 sm:text-base',
        className
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <div
      {...props}
      role="heading"
      aria-level={7}
      className={cn(
        'my-3 text-sm font-semibold text-pretty first:mt-0 last:mb-0',
        className
      )}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn('mb-5 mt-5 leading-7 first:mt-0 last:mb-0', className)}
      {...props}
    />
  ),
  a: ({ className, href, ...props }) => {
    const citationIndex = parseCitationHref(href)
    if (citationIndex !== null) return <CitationChip index={citationIndex} />

    return (
      <a
        className={cn(
          'text-primary font-medium underline underline-offset-4',
          className
        )}
        target="_blank"
        rel="noopener noreferrer"
        href={href}
        {...props}
      />
    )
  },
  // Styled as a soft amber info callout (e.g. a model-emitted "Hinweis" note),
  // not a plain citation-style quote: rounded block, amber left accent, and
  // `break-words` so long tokens (URLs) wrap instead of overflowing on
  // mobile widths.
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        'my-5 break-words rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-amber-900',
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn('my-5 ml-6 list-disc [&>li]:mt-2', className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn('my-5 ml-6 list-decimal [&>li]:mt-2', className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn('my-5 border-b', className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="my-5 overflow-x-auto">
      <table
        className={cn('w-full border-separate border-spacing-0', className)}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        'bg-muted px-4 py-2 text-left font-bold first:rounded-tl-lg last:rounded-tr-lg [&[align=center]]:text-center [&[align=right]]:text-right',
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        'border-b border-l px-4 py-2 text-left last:border-r [&[align=center]]:text-center [&[align=right]]:text-right',
        className
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        'm-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg',
        className
      )}
      {...props}
    />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={cn('[&>a]:text-xs [&>a]:no-underline', className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        'overflow-x-auto rounded-b-lg bg-black p-4 text-white',
        className
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock()
    return (
      <code
        className={cn(
          !isCodeBlock && 'bg-muted rounded border font-semibold',
          className
        )}
        {...props}
      />
    )
  },
  CodeHeader,
})

export function normalizeCustomMathTags(input: string): string {
  return (
    input
      // Keep display-math fences on their own lines so multiline formulas
      // cannot consume the Markdown that follows them.
      .replace(
        /\[\/math\]([\s\S]*?)\[\/math\]/g,
        (_, content) => `\n\n$$\n${content.trim()}\n$$\n\n`
      )
      // Convert [/inline]...[/inline] to $...$
      .replace(
        /\[\/inline\]([\s\S]*?)\[\/inline\]/g,
        (_, content) => `$${content.trim()}$`
      )
      // Convert \( ... \) to $...$ (inline math) - handles both single and double backslashes
      .replace(
        /\\{1,2}\(([\s\S]*?)\\{1,2}\)/g,
        (_, content) => `$${content.trim()}$`
      )
      // Convert \[ ... \] to $$...$$ (block math) - handles both single and double backslashes
      .replace(
        /\\{1,2}\[([\s\S]*?)\\{1,2}\]/g,
        (_, content) => `\n\n$$\n${content.trim()}\n$$\n\n`
      )
  )
}
