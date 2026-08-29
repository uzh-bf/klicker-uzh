import { Prisma } from '@klicker-uzh/prisma/client'
import { withTransaction } from '../../utils/transactions'

export const MAX_VALIDATED_HISTORY_ROWS = 256
export const MAX_MODEL_HISTORY_ROWS = 64

type HistoryHeader = {
  id: string
  threadId: string
  parentId: string | null
  role: string
  lifecycleStatus: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  depth: number
  cycle: boolean
}

export type AuthoritativeModelMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type PrepareAuthoritativeConversationInput = {
  participantId: string
  ownerId: string
  chatbotId: string
  threadId: string
  trigger: {
    id: string
    parentId: string | null
    text: string
    hasAttachments: boolean
  }
  metadata: {
    chatMode: string | null
    modelId: string | null
    reasoningEffort: string | null
  }
}

export type AuthoritativeConversation = {
  triggerText: string
  modelMessages: AuthoritativeModelMessage[]
  validatedRowCount: number
  modelRowCount: number
  truncated: boolean
  createdTrigger: boolean
}

export class AuthoritativeConversationError extends Error {
  constructor() {
    super('Chat conversation conflict')
    this.name = 'AuthoritativeConversationError'
  }
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim()
}

function persistedText(content: unknown): string {
  if (typeof content === 'string') return normalizeText(content)
  if (!Array.isArray(content)) return ''

  return normalizeText(
    content
      .flatMap((part) => {
        if (!part || typeof part !== 'object' || Array.isArray(part)) return []
        return part.type === 'text' && typeof part.text === 'string'
          ? [part.text]
          : []
      })
      .join('')
  )
}

function assertValidHeaders(
  rows: HistoryHeader[],
  threadId: string
): { truncated: boolean; closestRows: HistoryHeader[] } {
  if (rows.length === 0 || rows[0].depth !== 1) {
    throw new AuthoritativeConversationError()
  }

  const ids = new Set<string>()
  for (const [index, row] of rows.entries()) {
    if (
      row.depth !== index + 1 ||
      row.threadId !== threadId ||
      (row.role !== 'user' && row.role !== 'assistant') ||
      row.lifecycleStatus !== 'COMPLETED' ||
      row.cycle ||
      ids.has(row.id)
    ) {
      throw new AuthoritativeConversationError()
    }
    ids.add(row.id)

    const child = rows[index - 1]
    if (child && (child.parentId !== row.id || child.role === row.role)) {
      throw new AuthoritativeConversationError()
    }
  }

  const oldest = rows.at(-1)!
  const truncated =
    rows.length === MAX_VALIDATED_HISTORY_ROWS && oldest.parentId !== null
  if (!truncated && oldest.parentId !== null) {
    throw new AuthoritativeConversationError()
  }
  if (!truncated && oldest.role === 'assistant') {
    throw new AuthoritativeConversationError()
  }

  return {
    truncated,
    closestRows: rows.slice(0, MAX_MODEL_HISTORY_ROWS),
  }
}

export async function prepareAuthoritativeConversation(
  input: PrepareAuthoritativeConversationInput
): Promise<AuthoritativeConversation> {
  const triggerText = normalizeText(input.trigger.text)
  if (!triggerText && !input.trigger.hasAttachments) {
    throw new AuthoritativeConversationError()
  }

  return withTransaction(async (tx) => {
    const thread = await tx.chatThread.findFirst({
      where: {
        id: input.threadId,
        participantId: input.participantId,
        chatbotId: input.chatbotId,
        chatbot: { ownerId: input.ownerId },
      },
      select: { id: true },
    })
    if (!thread) throw new AuthoritativeConversationError()

    const created = await tx.chatMessage.createMany({
      data: {
        id: input.trigger.id,
        threadId: input.threadId,
        parentId: input.trigger.parentId,
        role: 'user',
        content: triggerText ? [{ type: 'text', text: triggerText }] : [],
        chatMode: input.metadata.chatMode,
        modelId: input.metadata.modelId,
        reasoningEffort: input.metadata.reasoningEffort,
        lifecycleStatus: 'COMPLETED',
      },
      skipDuplicates: true,
    })

    if (created.count === 0) {
      const existing = await tx.chatMessage.findUnique({
        where: { id: input.trigger.id },
        select: {
          threadId: true,
          parentId: true,
          role: true,
          content: true,
          lifecycleStatus: true,
        },
      })
      if (
        !existing ||
        existing.threadId !== input.threadId ||
        existing.parentId !== input.trigger.parentId ||
        existing.role !== 'user' ||
        existing.lifecycleStatus !== 'COMPLETED' ||
        persistedText(existing.content) !== triggerText
      ) {
        throw new AuthoritativeConversationError()
      }
    } else {
      await tx.chatThread.update({
        where: { id: input.threadId },
        data: { updatedAt: new Date() },
      })
    }

    const rows = await tx.$queryRaw<HistoryHeader[]>(Prisma.sql`
      WITH RECURSIVE branch AS (
        SELECT
          message.id,
          message."threadId",
          message."parentId",
          message.role,
          message."lifecycleStatus",
          1 AS depth,
          ARRAY[message.id]::uuid[] AS visited,
          false AS cycle
        FROM "ChatMessage" AS message
        WHERE message.id = ${input.trigger.id}::uuid

        UNION ALL

        SELECT
          parent.id,
          parent."threadId",
          parent."parentId",
          parent.role,
          parent."lifecycleStatus",
          branch.depth + 1,
          branch.visited || parent.id,
          parent.id = ANY(branch.visited)
        FROM branch
        JOIN "ChatMessage" AS parent ON parent.id = branch."parentId"
        WHERE
          branch."parentId" IS NOT NULL
          AND branch.depth < ${MAX_VALIDATED_HISTORY_ROWS}
          AND NOT branch.cycle
      )
      SELECT
        id,
        "threadId",
        "parentId",
        role,
        "lifecycleStatus",
        depth,
        cycle
      FROM branch
      ORDER BY depth ASC
    `)

    const { truncated, closestRows } = assertValidHeaders(rows, input.threadId)
    const projected = await tx.chatMessage.findMany({
      where: { id: { in: closestRows.map((row) => row.id) } },
      select: {
        id: true,
        role: true,
        content: true,
        attachments: {
          where: { imageDescription: { not: null } },
          select: { imageDescription: true },
          orderBy: { position: 'asc' },
        },
      },
    })
    const projectedById = new Map(
      projected.map((message) => [message.id, message])
    )

    const modelMessages = closestRows
      .toReversed()
      .flatMap<AuthoritativeModelMessage>((row) => {
        const message = projectedById.get(row.id)
        if (
          !message ||
          (message.role !== 'user' && message.role !== 'assistant')
        ) {
          throw new AuthoritativeConversationError()
        }

        let content = persistedText(message.content)
        const descriptions = message.attachments.flatMap((attachment) =>
          attachment.imageDescription ? [attachment.imageDescription] : []
        )
        if (message.role === 'user' && descriptions.length > 0) {
          const suffix = descriptions
            .map((description, index) =>
              descriptions.length === 1
                ? `[Attached image description: ${description}]`
                : `[Attached image ${index + 1} description: ${description}]`
            )
            .join('\n\n')
          content = content ? `${content}\n\n${suffix}` : suffix
        }

        if (message.role === 'assistant' && !content) return []
        return [{ id: message.id, role: message.role, content }]
      })

    return {
      triggerText,
      modelMessages,
      validatedRowCount: rows.length,
      modelRowCount: closestRows.length,
      truncated,
      createdTrigger: created.count === 1,
    }
  })
}
