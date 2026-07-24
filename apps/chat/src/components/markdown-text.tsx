'use client'

import '@assistant-ui/react-markdown/styles/dot.css'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import {
  CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from '@assistant-ui/react-markdown'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FC, memo, useState } from 'react'
import remarkGfm from 'remark-gfm'

import { cn } from '../lib/utils/ui'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      preprocess={normalizeCustomMathTags}
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
  // Rendered as h2: the chatbot name is the page's single h1, so message
  // headings must not compete at the same rank (visual size unchanged).
  h1: ({ className, ...props }) => (
    <h2
      className={cn(
        'mb-8 scroll-m-20 text-4xl font-extrabold tracking-tight last:mb-0',
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        'mb-4 mt-8 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0',
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        'mb-4 mt-6 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0',
        className
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        'mb-4 mt-6 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0',
        className
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn(
        'my-4 text-lg font-semibold first:mt-0 last:mb-0',
        className
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn('my-4 font-semibold first:mt-0 last:mb-0', className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn('mb-5 mt-5 leading-7 first:mt-0 last:mb-0', className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        'text-primary font-medium underline underline-offset-4',
        className
      )}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn('border-l-2 pl-6 italic', className)}
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
      // Convert [/math]...[/math] to $$...$$
      .replace(
        /\[\/math\]([\s\S]*?)\[\/math\]/g,
        (_, content) => `$$${content.trim()}$$`
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
        (_, content) => `$$${content.trim()}$$`
      )
  )
}
