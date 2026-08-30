import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import { applyPersonalElementRevision } from './graphqlClient'

type RevisionPart = {
  type?: unknown
  toolName?: unknown
  toolCallId?: unknown
  isError?: unknown
  result?: unknown
}

export type RevisionSettlement =
  | { status: 'none' | 'completed' }
  | { status: 'failed'; reason: 'invalid' | 'rejected' | 'unavailable' }

function pendingRevisionParts(content: unknown) {
  if (!Array.isArray(content)) return []
  return (content as RevisionPart[]).filter((part) => {
    if (
      part.type !== 'tool-call' ||
      part.toolName !== 'revise_personal_element' ||
      typeof part.toolCallId !== 'string' ||
      part.isError === true ||
      !part.result ||
      typeof part.result !== 'object' ||
      Array.isArray(part.result)
    ) {
      return false
    }
    return (part.result as { status?: unknown }).status === 'updated'
  })
}

function withAppliedVersion(
  content: unknown,
  toolCallId: string,
  version: number
) {
  if (!Array.isArray(content)) return content
  return (content as RevisionPart[]).map((part) =>
    part.type === 'tool-call' &&
    part.toolName === 'revise_personal_element' &&
    part.toolCallId === toolCallId &&
    part.result &&
    typeof part.result === 'object' &&
    !Array.isArray(part.result)
      ? { ...part, result: { ...part.result, version } }
      : part
  )
}

function withRevisionFailure(
  content: unknown,
  toolCallId: string,
  status: 'conflict' | 'unavailable'
) {
  if (!Array.isArray(content)) return content
  return (content as RevisionPart[]).map((part) => {
    if (
      part.type !== 'tool-call' ||
      part.toolName !== 'revise_personal_element' ||
      part.toolCallId !== toolCallId ||
      !part.result ||
      typeof part.result !== 'object' ||
      Array.isArray(part.result)
    ) {
      return part
    }
    const result = part.result as Record<string, unknown>
    return {
      ...part,
      result: {
        status,
        id: result.id,
        expectedVersion: result.expectedVersion,
        ...(status === 'conflict'
          ? {
              reason: 'The saved card changed before this revision completed',
            }
          : {}),
      },
    }
  })
}

function isGraphqlRejection(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'extensions' in error &&
      (error as { extensions?: unknown }).extensions
  )
}

export async function settlePersonalElementRevision({
  prisma,
  participantId,
  courseId,
  threadId,
  assistantMessageId,
  assistantMessagePersisted,
  assistantMessageContent,
}: {
  prisma: PrismaClient
  participantId: string
  courseId: string
  threadId: string | null
  assistantMessageId: string
  assistantMessagePersisted: boolean
  assistantMessageContent: unknown
}): Promise<RevisionSettlement> {
  const revisions = pendingRevisionParts(assistantMessageContent)
  if (revisions.length === 0) return { status: 'none' }
  if (!assistantMessagePersisted || !threadId || revisions.length !== 1) {
    return { status: 'failed', reason: 'invalid' }
  }

  const toolCallId = revisions[0]?.toolCallId
  if (typeof toolCallId !== 'string') {
    return { status: 'failed', reason: 'invalid' }
  }
  const persistRevisionFailure = (status: 'conflict' | 'unavailable') =>
    prisma.chatMessage.updateMany({
      where: { id: assistantMessageId, threadId, role: 'assistant' },
      data: {
        content: withRevisionFailure(
          assistantMessageContent,
          toolCallId,
          status
        ) as Prisma.InputJsonValue,
      },
    })
  const linkage = { courseId, messageId: assistantMessageId, toolCallId }
  let updated: Awaited<ReturnType<typeof applyPersonalElementRevision>>
  try {
    updated = await applyPersonalElementRevision(linkage, participantId)
  } catch (error) {
    if (isGraphqlRejection(error)) {
      await persistRevisionFailure('conflict')
      return { status: 'failed', reason: 'rejected' }
    }
    try {
      updated = await applyPersonalElementRevision(linkage, participantId)
    } catch (retryError) {
      if (isGraphqlRejection(retryError)) {
        await persistRevisionFailure('conflict')
      } else {
        await persistRevisionFailure('unavailable')
      }
      return {
        status: 'failed',
        reason: isGraphqlRejection(retryError) ? 'rejected' : 'unavailable',
      }
    }
  }

  const content = withAppliedVersion(
    assistantMessageContent,
    toolCallId,
    updated.version
  )
  await prisma.chatMessage.updateMany({
    where: {
      id: assistantMessageId,
      threadId,
      role: 'assistant',
    },
    data: { content: content as Prisma.InputJsonValue },
  })
  return { status: 'completed' }
}
