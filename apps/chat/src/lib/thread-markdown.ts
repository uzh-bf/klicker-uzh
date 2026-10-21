import { normalizeSourcesFromParts } from './sources/normalizeSources'
import { getSourceNavigationUrl } from './sources/sourceUrl'
import type { ExtendedThreadMessageLike } from '../stores/chatStore'

export interface ThreadMarkdownLabels {
  user: string
  assistant: string
  sources: string
}

const getMessageText = (message: ExtendedThreadMessageLike): string => {
  if (typeof message.content === 'string') return message.content.trim()
  // Only answer text is exported. Tool calls, reasoning and data markers are
  // internals of how the answer was produced, not part of the study note.
  return message.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim()
}

const getSourceLines = (message: ExtendedThreadMessageLike): string[] => {
  if (typeof message.content === 'string') return []
  // The answer text cites sources as `[n]`; the targets live in the doc_query
  // results skipped above, so list them to keep those markers resolvable.
  return normalizeSourcesFromParts(message.content).map((source) => {
    const url = getSourceNavigationUrl(source.url, source.page)
    const label = source.labeledPage
      ? `${source.title}, ${source.labeledPage}`
      : source.title
    return url
      ? `[${source.index}] [${label}](${url})`
      : `[${source.index}] ${label}`
  })
}

/**
 * Renders a thread's current branch as a Markdown document: the title as a
 * heading, then each user and assistant turn in order. Message text is kept
 * verbatim so LaTeX delimiters, links and `[n]` citation markers survive.
 */
export const threadToMarkdown = ({
  title,
  messages,
  labels,
}: {
  title: string
  messages: readonly ExtendedThreadMessageLike[]
  labels: ThreadMarkdownLabels
}): string => {
  const sections = [`# ${title}`]

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const text = getMessageText(message)
    if (!text) continue

    const heading = message.role === 'user' ? labels.user : labels.assistant
    sections.push(`## ${heading}`, text)

    const sourceLines =
      message.role === 'assistant' ? getSourceLines(message) : []
    if (sourceLines.length > 0) {
      sections.push(`**${labels.sources}**`, sourceLines.join('  \n'))
    }
  }

  return `${sections.join('\n\n')}\n`
}

/** Turns a thread title into a safe `.md` download filename. */
export const getThreadMarkdownFilename = (title: string, threadId: string) => {
  const safeTitle = title
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strips control characters from filenames
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
  return `${safeTitle || `chat-${threadId}`}.md`
}
