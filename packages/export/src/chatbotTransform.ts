import type { Prisma } from '@klicker-uzh/prisma/client'

interface DecimalLike {
  toString(): string
}

export interface RawChatbotExportRow {
  id: string
  name: string
  description: string | null
  systemPrompts: Prisma.JsonValue | null
  creditInitialCredits: number
  creditResetPeriod: string
  creditResetAmount: number
  creditMaxCredits: number
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
  threads: Array<{
    id: string
    title: string | null
    participantId: string
    createdAt: Date
    updatedAt: Date
    messages: Array<{
      id: string
      parentId: string | null
      role: string
      content: Prisma.JsonValue
      chatMode: string | null
      modelId: string | null
      reasoningEffort: string | null
      reasoningContent: string | null
      creditsUsed: DecimalLike | null
      createdAt: Date
      updatedAt: Date
      attachments: Array<{
        id: string
        type: string
        position: number
        imageDescription: string | null
        createdAt: Date
        updatedAt: Date
      }>
    }>
  }>
}

export interface ChatbotExportAttachment {
  id: string
  type: string
  position: number
  imageDescription: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatbotExportMessage {
  id: string
  parentId: string | null
  role: string
  content: Prisma.JsonValue
  chatMode: string | null
  modelId: string | null
  reasoningEffort: string | null
  reasoningContent: string | null
  creditsUsed: string | null
  createdAt: string
  updatedAt: string
  attachments: ChatbotExportAttachment[]
}

export interface ChatbotExportThread {
  id: string
  participantId: string
  title: string | null
  createdAt: string
  updatedAt: string
  messages: ChatbotExportMessage[]
}

export interface ChatbotExportChatbot {
  id: string
  name: string
  description: string | null
  systemPrompts: Prisma.JsonValue | null
  creditInitialCredits: number
  creditResetPeriod: string
  creditResetAmount: number
  creditMaxCredits: number
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel: Prisma.JsonValue | null
  createdAt: string
  updatedAt: string
  threads: ChatbotExportThread[]
}

export interface ChatbotExportDocument {
  schemaVersion: 1
  exportedAt: string
  privacy: {
    mode: 'pseudonymized'
    warning: string
  }
  scope: {
    includedModels: readonly string[]
    excludedModels: readonly string[]
    attachmentImagesIncluded: false
  }
  counts: {
    chatbots: number
    participants: number
    threads: number
    messages: number
    attachments: number
  }
  chatbots: ChatbotExportChatbot[]
}

const scope = {
  includedModels: ['Chatbot', 'ChatThread', 'ChatMessage', 'ChatAttachment'],
  excludedModels: [
    'ChatUsageCredits',
    'ChatbotDisclaimer',
    'ChatbotMCPConfig',
    'ChatbotMCPServer',
    'User',
    'Course',
    'Participant',
  ],
  attachmentImagesIncluded: false,
} as const

export function createKeyMap(values: string[], prefix: string) {
  const unique = [...new Set(values)].sort()

  return new Map(
    unique.map((value, index) => [
      value,
      `${prefix}_${String(index + 1).padStart(5, '0')}`,
    ])
  )
}

function collectToolCallIds(value: Prisma.JsonValue, ids: Set<string>) {
  if (Array.isArray(value)) {
    for (const entry of value) collectToolCallIds(entry, ids)
    return
  }

  if (value == null || typeof value !== 'object') return

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'toolCallId' && typeof entry === 'string') ids.add(entry)
    if (entry !== undefined) collectToolCallIds(entry, ids)
  }
}

function rewriteContent(
  value: Prisma.JsonValue,
  knownIds: Map<string, string>,
  toolCallIds: Map<string, string>,
  threadId: string,
  key?: string
): Prisma.JsonValue {
  if (typeof value === 'string') {
    if (key === 'text') return value
    if (key === 'toolCallId') {
      return toolCallIds.get(`${threadId}\0${value}`) ?? value
    }
    return knownIds.get(value) ?? value
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      rewriteContent(entry, knownIds, toolCallIds, threadId)
    )
  }

  if (value == null || typeof value !== 'object') return value

  const rewritten: Prisma.JsonObject = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryValue !== undefined) {
      rewritten[entryKey] = rewriteContent(
        entryValue,
        knownIds,
        toolCallIds,
        threadId,
        entryKey
      )
    }
  }
  return rewritten
}

function compareDateThenId(
  left: { id: string; createdAt: Date },
  right: { id: string; createdAt: Date }
) {
  return (
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  )
}

function requiredKey(
  map: Map<string, string>,
  sourceId: string,
  label: string
) {
  const value = map.get(sourceId)
  if (value == null) throw new Error(`Unresolved ${label}: ${sourceId}`)
  return value
}

function mergeKnownIds(...maps: Array<Map<string, string>>) {
  const merged = new Map<string, string>()

  for (const map of maps) {
    for (const [sourceId, exportId] of map) {
      const existing = merged.get(sourceId)
      if (existing != null && existing !== exportId) {
        throw new Error(`Ambiguous source identifier: ${sourceId}`)
      }
      merged.set(sourceId, exportId)
    }
  }

  return merged
}

function validateThreadParents(thread: RawChatbotExportRow['threads'][number]) {
  const messagesById = new Map(
    thread.messages.map((message) => [message.id, message])
  )

  for (const message of thread.messages) {
    if (message.parentId == null) continue
    if (message.parentId === message.id) {
      throw new Error(
        `Self-referencing parent message id in thread ${thread.id}: ${message.id}`
      )
    }
    if (!messagesById.has(message.parentId)) {
      throw new Error(
        `Unresolved parent message id in thread ${thread.id}: ${message.parentId}`
      )
    }
  }

  const state = new Map<string, 'visiting' | 'visited'>()
  const visit = (messageId: string) => {
    const currentState = state.get(messageId)
    if (currentState === 'visiting') {
      throw new Error(
        `Cyclic parent message chain in thread ${thread.id}: ${messageId}`
      )
    }
    if (currentState === 'visited') return

    state.set(messageId, 'visiting')
    const parentId = messagesById.get(messageId)?.parentId
    if (parentId != null) visit(parentId)
    state.set(messageId, 'visited')
  }

  for (const message of thread.messages) visit(message.id)
}

export function buildChatbotExportDocument(
  rows: RawChatbotExportRow[],
  exportedAt: string
): ChatbotExportDocument {
  const chatbots = [...rows].sort((left, right) =>
    left.id.localeCompare(right.id)
  )
  const threads = chatbots.flatMap((chatbot) => chatbot.threads)
  const messages = threads.flatMap((thread) => thread.messages)
  const attachments = messages.flatMap((message) => message.attachments)

  for (const thread of threads) validateThreadParents(thread)

  const chatbotIds = createKeyMap(
    chatbots.map((chatbot) => chatbot.id),
    'chatbot'
  )
  const participantIds = createKeyMap(
    threads.map((thread) => thread.participantId),
    'participant'
  )
  const threadIds = createKeyMap(
    threads.map((thread) => thread.id),
    'thread'
  )
  const messageIds = createKeyMap(
    messages.map((message) => message.id),
    'message'
  )
  const attachmentIds = createKeyMap(
    attachments.map((attachment) => attachment.id),
    'attachment'
  )
  const toolCallSourceIds: string[] = []
  for (const thread of threads) {
    const threadToolCallIds = new Set<string>()
    for (const message of thread.messages) {
      collectToolCallIds(message.content, threadToolCallIds)
    }
    for (const toolCallId of threadToolCallIds) {
      toolCallSourceIds.push(`${thread.id}\0${toolCallId}`)
    }
  }
  const toolCallIds = createKeyMap(toolCallSourceIds, 'tool_call')
  const knownIds = mergeKnownIds(
    chatbotIds,
    participantIds,
    threadIds,
    messageIds,
    attachmentIds
  )

  return {
    schemaVersion: 1,
    exportedAt,
    privacy: {
      mode: 'pseudonymized',
      warning:
        'Conversation text and attachment descriptions are unchanged; this export is not anonymized.',
    },
    scope,
    counts: {
      chatbots: chatbots.length,
      participants: participantIds.size,
      threads: threads.length,
      messages: messages.length,
      attachments: attachments.length,
    },
    chatbots: chatbots.map((chatbot) => ({
      id: requiredKey(chatbotIds, chatbot.id, 'chatbot id'),
      name: chatbot.name,
      description: chatbot.description,
      systemPrompts: chatbot.systemPrompts,
      creditInitialCredits: chatbot.creditInitialCredits,
      creditResetPeriod: chatbot.creditResetPeriod,
      creditResetAmount: chatbot.creditResetAmount,
      creditMaxCredits: chatbot.creditMaxCredits,
      modelSelection: chatbot.modelSelection,
      allowedModelIds: chatbot.allowedModelIds,
      allowedReasoningEffortsByModel: chatbot.allowedReasoningEffortsByModel,
      createdAt: chatbot.createdAt.toISOString(),
      updatedAt: chatbot.updatedAt.toISOString(),
      threads: [...chatbot.threads].sort(compareDateThenId).map((thread) => ({
        id: requiredKey(threadIds, thread.id, 'thread id'),
        participantId: requiredKey(
          participantIds,
          thread.participantId,
          'participant id'
        ),
        title: thread.title,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        messages: [...thread.messages]
          .sort(compareDateThenId)
          .map((message) => ({
            id: requiredKey(messageIds, message.id, 'message id'),
            parentId:
              message.parentId == null
                ? null
                : requiredKey(messageIds, message.parentId, 'parent id'),
            role: message.role,
            content: rewriteContent(
              message.content,
              knownIds,
              toolCallIds,
              thread.id
            ),
            chatMode: message.chatMode,
            modelId: message.modelId,
            reasoningEffort: message.reasoningEffort,
            reasoningContent: message.reasoningContent,
            creditsUsed: message.creditsUsed?.toString() ?? null,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt.toISOString(),
            attachments: [...message.attachments]
              .sort(
                (left, right) =>
                  left.position - right.position ||
                  left.id.localeCompare(right.id)
              )
              .map((attachment) => ({
                id: requiredKey(attachmentIds, attachment.id, 'attachment id'),
                type: attachment.type,
                position: attachment.position,
                imageDescription: attachment.imageDescription,
                createdAt: attachment.createdAt.toISOString(),
                updatedAt: attachment.updatedAt.toISOString(),
              })),
          })),
      })),
    })),
  }
}
