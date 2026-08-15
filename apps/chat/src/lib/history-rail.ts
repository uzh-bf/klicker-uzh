import type { ExtendedThreadMessageLike } from '../stores/chatStore'

export type HistoryRailEntryKind =
  | 'user'
  | 'assistant'
  | 'reasoning'
  | 'tool'
  | 'error'

export type HistoryRailEntryStatus =
  | 'complete'
  | 'running'
  | 'partial'
  | 'error'

export type HistoryRailEntry = {
  anchor: string
  id: string
  kind: HistoryRailEntryKind
  messageId: string
  partKey?: string
  preview?: string
  status: HistoryRailEntryStatus
  toolName?: string
}

export type HistoryRailTickRange = {
  endIndex: number
  representativeIndex: number
  startIndex: number
}

type MessageWithId = ExtendedThreadMessageLike & { id: string }

const MAX_PREVIEW_LENGTH = 72

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

const truncatePreview = (value: string): string | undefined => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return undefined
  if (normalized.length <= MAX_PREVIEW_LENGTH) return normalized
  return `${normalized.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}…`
}

const getMessagePreview = (message: MessageWithId): string | undefined => {
  const content = Array.isArray(message.content)
    ? message.content
    : [{ type: 'text' as const, text: message.content }]
  const text = content
    .filter((part) => part.type === 'text')
    .map((part) =>
      'text' in part && typeof part.text === 'string' ? part.text : ''
    )
    .join(' ')

  return truncatePreview(text)
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

export const getHistoryRailPartAnchor = (
  messageId: string,
  partKey: string
): string => `part:${messageId}:${partKey}`

const createMessageEntry = (message: MessageWithId): HistoryRailEntry => {
  const anchor = getHistoryRailMessageAnchor(message.id)

  return {
    anchor,
    id: anchor,
    kind: message.role === 'user' ? 'user' : 'assistant',
    messageId: message.id,
    preview: getMessagePreview(message),
    status: normalizeStatus(
      (message as ExtendedThreadMessageLike & { status?: unknown }).status
    ),
  }
}

const createPartEntry = ({
  kind,
  message,
  partKey,
  preview,
  status,
  toolName,
}: {
  kind: Exclude<HistoryRailEntryKind, 'user' | 'assistant'>
  message: MessageWithId
  partKey: string
  preview?: string
  status: unknown
  toolName?: string
}): HistoryRailEntry => {
  const anchor = getHistoryRailPartAnchor(message.id, partKey)

  return {
    anchor,
    id: anchor,
    kind,
    messageId: message.id,
    partKey,
    preview,
    status: normalizeStatus(status),
    toolName,
  }
}

const getAssistantPartEntries = (
  message: MessageWithId
): HistoryRailEntry[] => {
  const entries: HistoryRailEntry[] = []
  const seenToolCallIds = new Set<string>()
  const messageStatus = (
    message as ExtendedThreadMessageLike & { status?: unknown }
  ).status
  let reasoningGroupStart: number | null = null

  const content = Array.isArray(message.content) ? message.content : []

  for (const [index, part] of content.entries()) {
    if (part.type === 'reasoning') {
      const text =
        'text' in part && typeof part.text === 'string' ? part.text : ''
      if (text.trim().length === 0) continue

      if (reasoningGroupStart === null) {
        reasoningGroupStart = index
        entries.push(
          createPartEntry({
            kind: 'reasoning',
            message,
            partKey: `reasoning:${index}`,
            preview: truncatePreview(text),
            status: (part as { status?: unknown }).status ?? messageStatus,
          })
        )
      }
      continue
    }

    reasoningGroupStart = null

    if (part.type === 'tool-call') {
      const toolCallId =
        'toolCallId' in part && typeof part.toolCallId === 'string'
          ? part.toolCallId
          : undefined
      const toolName =
        'toolName' in part && typeof part.toolName === 'string'
          ? part.toolName
          : undefined

      if (toolCallId && seenToolCallIds.has(toolCallId)) continue
      if (toolCallId) seenToolCallIds.add(toolCallId)

      entries.push(
        createPartEntry({
          kind: 'tool',
          message,
          partKey: `tool:${toolCallId ?? index}`,
          status: (part as { status?: unknown }).status ?? messageStatus,
          toolName,
        })
      )
      continue
    }

    if (
      part.type === 'data' &&
      'name' in part &&
      part.name === 'chat-error' &&
      !entries.some((entry) => entry.kind === 'error')
    ) {
      entries.push(
        createPartEntry({
          kind: 'error',
          message,
          partKey: 'error',
          status: { type: 'error' },
        })
      )
    }
  }

  return entries
}

/**
 * Projects the selected conversation path into navigable history entries.
 * `messages` is intentionally the active path, not `allMessages`, so branch
 * switching cannot leave stale sibling entries in the rail.
 */
export const getHistoryRailEntries = (
  messages: readonly ExtendedThreadMessageLike[]
): HistoryRailEntry[] =>
  messages.flatMap((message) => {
    if (
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.id !== 'string'
    ) {
      return []
    }

    const messageWithId = message as MessageWithId

    const messageEntry = createMessageEntry(messageWithId)
    return message.role === 'assistant'
      ? [messageEntry, ...getAssistantPartEntries(messageWithId)]
      : [messageEntry]
  })
