import type { ExtendedThreadMessageLike } from '../stores/chatStore'

export type HistoryRailEntryKind = 'turn'

export type HistoryRailEntryStatus =
  | 'complete'
  | 'running'
  | 'partial'
  | 'error'

export type HistoryRailEntry = {
  anchor: string
  assistantMessageId?: string
  assistantText?: string
  id: string
  kind: HistoryRailEntryKind
  messageId: string
  status: HistoryRailEntryStatus
  userMessageId?: string
  userText?: string
}

export type HistoryRailTickRange = {
  endIndex: number
  representativeIndex: number
  startIndex: number
}

type MessageWithId = ExtendedThreadMessageLike & { id: string }

const MAX_PLAIN_TEXT_LENGTH = 100

const getStatusType = (status: unknown): string | undefined => {
  if (typeof status !== 'object' || status === null || !('type' in status)) {
    return undefined
  }

  const type = status.type
  return typeof type === 'string' ? type : undefined
}

const normalizeStatus = (status: unknown): HistoryRailEntryStatus => {
  switch (getStatusType(status)) {
    case 'running':
      return 'running'
    case 'error':
      return 'error'
    case 'incomplete':
    case 'requires-action':
    case 'requires_action':
      return 'partial'
    default:
      return 'complete'
  }
}

const getMessageText = (message: MessageWithId): string | undefined => {
  const content = Array.isArray(message.content)
    ? message.content
    : [{ type: 'text' as const, text: message.content }]
  const text = content
    .filter((part) => part.type === 'text')
    .map((part) =>
      'text' in part && typeof part.text === 'string' ? part.text : ''
    )
    .filter((part) => part.trim().length > 0)
    .join('\n\n')
    .trim()

  return text || undefined
}

// Best-effort Markdown stripper, not a full CommonMark parser: it keeps text
// content while dropping syntax markers, sized for short navigation labels
// rather than faithful rendering.
const stripMarkdown = (value: string): string =>
  value
    .replace(/^ {0,3}`{3}[^\n]*$/gm, '') // fenced code block delimiter lines
    .replace(/`{1,3}/g, '') // remaining inline code backticks
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^ {0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '') // list markers
    .replace(/(\*\*\*|___)([\s\S]+?)\1/g, '$2') // bold+italic
    .replace(/(\*\*|__)([\s\S]+?)\1/g, '$2') // bold
    .replace(/(\*|_)([\s\S]+?)\1/g, '$2') // italic
    .replace(/~~([\s\S]+?)~~/g, '$1') // strikethrough

/**
 * Projects raw (possibly Markdown) turn text into a plain-text navigation
 * label: strips Markdown syntax, collapses whitespace, and truncates to a
 * length suitable for rail tick labels and history dialog rows. The full
 * Markdown text stays available separately for the hover popover body.
 */
export const toHistoryRailPlainText = (value: string): string | undefined => {
  const normalized = stripMarkdown(value).replace(/\s+/g, ' ').trim()
  if (!normalized) return undefined
  if (normalized.length <= MAX_PLAIN_TEXT_LENGTH) return normalized
  return `${normalized.slice(0, MAX_PLAIN_TEXT_LENGTH - 1).trimEnd()}…`
}

const hasDataPart = (message: MessageWithId, name: string): boolean =>
  Array.isArray(message.content) &&
  message.content.some(
    (part) => part.type === 'data' && 'name' in part && part.name === name
  )

const getMessageStatus = (message: MessageWithId): HistoryRailEntryStatus => {
  if (hasDataPart(message, 'chat-error')) return 'error'
  // A turn the participant stopped mid-stream is incomplete but not failed.
  if (hasDataPart(message, 'chat-stopped')) return 'partial'

  return normalizeStatus(
    (message as ExtendedThreadMessageLike & { status?: unknown }).status
  )
}

/**
 * Divides a long history into a bounded set of navigable visual landmarks.
 * Each landmark points at one representative entry while retaining the range
 * it summarizes for accessible labels and hover details.
 */
export const getHistoryRailTickRanges = (
  total: number,
  limit: number
): HistoryRailTickRange[] => {
  if (total <= 0 || limit <= 0) return []

  const count = Math.min(total, limit)

  return Array.from({ length: count }, (_, index) => {
    const startIndex = Math.floor((index * total) / count)
    const endIndex = Math.max(
      startIndex,
      Math.floor(((index + 1) * total) / count) - 1
    )

    return {
      endIndex,
      representativeIndex: Math.floor((startIndex + endIndex) / 2),
      startIndex,
    }
  })
}

export const getHistoryRailMessageAnchor = (messageId: string): string =>
  `message:${messageId}`

const createTurnEntry = ({
  assistant,
  user,
}: {
  assistant?: MessageWithId
  user?: MessageWithId
}): HistoryRailEntry => {
  const message = user ?? assistant
  if (!message) {
    throw new Error('A history rail turn needs at least one message')
  }

  const userText = user ? getMessageText(user) : undefined
  const assistantText = assistant ? getMessageText(assistant) : undefined
  const anchor = getHistoryRailMessageAnchor(message.id)

  return {
    anchor,
    assistantMessageId: assistant?.id,
    assistantText,
    id: `turn:${user?.id ?? 'none'}:${assistant?.id ?? 'none'}`,
    kind: 'turn',
    messageId: message.id,
    status: assistant ? getMessageStatus(assistant) : 'complete',
    userMessageId: user?.id,
    userText,
  }
}

/**
 * Projects the selected conversation path into one landmark per turn.
 *
 * The active path is intentionally paired locally: a user message followed
 * by an assistant message becomes one rail entry. Tool calls, reasoning, and
 * error parts stay in the transcript and affect the assistant status, but do
 * not become additional navigation landmarks.
 */
export const getHistoryRailEntries = (
  messages: readonly ExtendedThreadMessageLike[]
): HistoryRailEntry[] => {
  const messagePath = messages.filter(
    (message): message is MessageWithId =>
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.id === 'string'
  )
  const entries: HistoryRailEntry[] = []

  for (let index = 0; index < messagePath.length; index += 1) {
    const message = messagePath[index]
    const nextMessage = messagePath[index + 1]

    if (message.role === 'user') {
      if (nextMessage?.role === 'assistant') {
        entries.push(createTurnEntry({ assistant: nextMessage, user: message }))
        index += 1
      } else {
        entries.push(createTurnEntry({ user: message }))
      }
      continue
    }

    entries.push(createTurnEntry({ assistant: message }))
  }

  return entries
}
