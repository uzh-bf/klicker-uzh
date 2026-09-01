import { getEffectiveChatAccountUsage, prisma } from '@klicker-uzh/prisma'
import { type ChatUsageClass, Prisma } from '@klicker-uzh/prisma/client'
import { getZurichMonthStart } from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { withTransaction } from '../utils/transactions'

const CREDIT_SCALE = 6
const CREDIT_LIMIT = new Prisma.Decimal('1000000000000')
export const CHAT_TURN_ALREADY_COMPLETED_CODE = 'CHAT_TURN_ALREADY_COMPLETED'
export const CHAT_TURN_IN_PROGRESS_CODE = 'CHAT_TURN_IN_PROGRESS'

export function isChatAccountUsageEnforcementEnabled(): boolean {
  return process.env.CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED === 'true'
}

export function isChatTurnLifecycleWritesEnabled(): boolean {
  return process.env.CHAT_TURN_LIFECYCLE_WRITES_ENABLED === 'true'
}

export class ChatTurnConflictError extends Error {
  readonly code = CHAT_TURN_ALREADY_COMPLETED_CODE

  constructor() {
    super('Chat turn already completed')
    this.name = 'ChatTurnConflictError'
  }
}

export type FinalizeChatTurnInput = {
  ownerId: string
  chatbotId: string
  usageClass: ChatUsageClass
  threadId: string
  assistantMessageId: string
  lifecycleAttemptId: string | null
  parentId: string | null
  content: Prisma.InputJsonValue
  chatMode: string | null
  modelId: string | null
  reasoningEffort: string | null
  reasoningContent: string | null
  rawCreditsUsed: number | null
  now?: Date
}

export type FinalizeChatTurnResult = {
  outcome: 'completed' | 'duplicate' | 'empty'
  creditsUsed: number | null
}

export type ClaimChatTurnInput = {
  ownerId: string
  chatbotId: string
  threadId: string
  assistantMessageId: string
  parentId: string | null
  allowRegeneration?: boolean
}

export type ClaimChatTurnResult =
  | { outcome: 'claimed'; lifecycleAttemptId: string | null }
  | { outcome: 'in_progress'; lifecycleAttemptId: null }
  | { outcome: 'completed'; lifecycleAttemptId: null }

export function roundChatUsageCredits(value: number): Prisma.Decimal {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Chat usage credits must be finite and non-negative')
  }

  const rounded = new Prisma.Decimal(value.toString()).toDecimalPlaces(
    CREDIT_SCALE,
    Prisma.Decimal.ROUND_HALF_UP
  )
  if (rounded.greaterThanOrEqualTo(CREDIT_LIMIT)) {
    throw new RangeError('Chat usage credits exceed Decimal(18,6)')
  }

  return rounded
}

async function lockChatTurnParent(
  tx: Prisma.TransactionClient,
  threadId: string,
  parentId: string | null
): Promise<void> {
  if (!parentId) return

  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`chat-turn:${threadId}:${parentId}`}))`
  )
}

export async function isChatAccountUsageAvailable({
  ownerId,
  usageClass,
  now = new Date(),
}: {
  ownerId: string
  usageClass: ChatUsageClass
  now?: Date
}): Promise<boolean> {
  const monthStart = getZurichMonthStart(now)
  const [owner, usage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { aiChatbotPublishingEnabled: true },
    }),
    getEffectiveChatAccountUsage(prisma, {
      ownerId,
      usageClass,
      monthStart,
    }),
  ])

  return Boolean(
    owner?.aiChatbotPublishingEnabled &&
      usage?.budgetCredits.greaterThan(0) &&
      usage.usedCredits.lessThan(usage.budgetCredits)
  )
}

export async function claimChatTurn(
  input: ClaimChatTurnInput
): Promise<ClaimChatTurnResult> {
  const lifecycleAttemptId = isChatTurnLifecycleWritesEnabled()
    ? randomUUID()
    : null

  return withTransaction(async (tx) => {
    const thread = await tx.chatThread.findFirst({
      where: {
        id: input.threadId,
        chatbotId: input.chatbotId,
        chatbot: { ownerId: input.ownerId },
      },
      select: { id: true },
    })
    if (!thread) {
      throw new ChatTurnConflictError()
    }

    if (!input.allowRegeneration) {
      await lockChatTurnParent(tx, input.threadId, input.parentId)
    }

    const existing = await tx.chatMessage.findUnique({
      where: { id: input.assistantMessageId },
      select: {
        role: true,
        threadId: true,
        lifecycleStatus: true,
        thread: {
          select: {
            chatbotId: true,
            chatbot: { select: { ownerId: true } },
          },
        },
      },
    })
    if (
      existing &&
      (existing.role !== 'assistant' ||
        existing.threadId !== input.threadId ||
        existing.thread.chatbotId !== input.chatbotId ||
        existing.thread.chatbot.ownerId !== input.ownerId)
    ) {
      throw new ChatTurnConflictError()
    }

    if (existing?.lifecycleStatus === 'COMPLETED') {
      return { outcome: 'completed', lifecycleAttemptId: null }
    }
    if (existing?.lifecycleStatus === 'IN_PROGRESS') {
      return { outcome: 'in_progress', lifecycleAttemptId: null }
    }

    if (!input.allowRegeneration) {
      const activeSibling = input.parentId
        ? await tx.chatMessage.findFirst({
            where: {
              threadId: input.threadId,
              parentId: input.parentId,
              role: 'assistant',
              lifecycleStatus: { in: ['IN_PROGRESS', 'COMPLETED'] },
            },
            select: { lifecycleStatus: true },
          })
        : null
      if (activeSibling) {
        return activeSibling.lifecycleStatus === 'COMPLETED'
          ? { outcome: 'completed', lifecycleAttemptId: null }
          : { outcome: 'in_progress', lifecycleAttemptId: null }
      }

      // A failed attempt may still have a provider callback in flight. Clear
      // its attempt token before accepting a different normal claim so that
      // the late callback cannot complete and charge a second sibling.
      if (input.parentId) {
        await tx.chatMessage.updateMany({
          where: {
            threadId: input.threadId,
            parentId: input.parentId,
            role: 'assistant',
            lifecycleStatus: 'FAILED',
            lifecycleAttemptId: { not: null },
            id: { not: input.assistantMessageId },
          },
          data: { lifecycleAttemptId: null },
        })
      }
    }

    if (existing?.lifecycleStatus === 'FAILED') {
      const reclaimed = await tx.chatMessage.updateMany({
        where: {
          id: input.assistantMessageId,
          threadId: input.threadId,
          role: 'assistant',
          lifecycleStatus: 'FAILED',
        },
        data: {
          parentId: input.parentId,
          content: [],
          chatMode: null,
          modelId: null,
          reasoningEffort: null,
          reasoningContent: null,
          creditsUsed: null,
          lifecycleStatus: 'IN_PROGRESS',
          lifecycleAttemptId,
        },
      })
      if (reclaimed.count === 1) {
        return { outcome: 'claimed', lifecycleAttemptId }
      }
    }

    // R1 keeps the attempt token disabled, but the durable marker still
    // claims the provider work. Supported history readers return COMPLETED
    // messages only, so they do not render this empty marker.
    const created = await tx.chatMessage.createMany({
      data: {
        id: input.assistantMessageId,
        threadId: input.threadId,
        parentId: input.parentId,
        role: 'assistant',
        content: [],
        lifecycleStatus: 'IN_PROGRESS',
        lifecycleAttemptId,
      },
      skipDuplicates: true,
    })
    if (created.count === 1) {
      return { outcome: 'claimed', lifecycleAttemptId }
    }

    const collision = await tx.chatMessage.findUnique({
      where: { id: input.assistantMessageId },
      select: {
        role: true,
        threadId: true,
        lifecycleStatus: true,
        thread: {
          select: {
            chatbotId: true,
            chatbot: { select: { ownerId: true } },
          },
        },
      },
    })
    if (
      collision?.role !== 'assistant' ||
      collision.threadId !== input.threadId ||
      collision.thread.chatbotId !== input.chatbotId ||
      collision.thread.chatbot.ownerId !== input.ownerId
    ) {
      throw new ChatTurnConflictError()
    }
    if (collision.lifecycleStatus === 'COMPLETED') {
      return { outcome: 'completed', lifecycleAttemptId: null }
    }
    if (collision.lifecycleStatus === 'IN_PROGRESS') {
      return { outcome: 'in_progress', lifecycleAttemptId: null }
    }

    throw new ChatTurnConflictError()
  })
}

export async function failChatTurn({
  assistantMessageId,
  threadId,
  lifecycleAttemptId,
}: {
  assistantMessageId: string
  threadId: string
  lifecycleAttemptId: string | null
}): Promise<void> {
  if (lifecycleAttemptId === null) {
    await prisma.chatMessage.deleteMany({
      where: {
        id: assistantMessageId,
        threadId,
        role: 'assistant',
        lifecycleStatus: 'IN_PROGRESS',
        lifecycleAttemptId: null,
      },
    })
    return
  }

  await prisma.chatMessage.updateMany({
    where: {
      id: assistantMessageId,
      threadId,
      role: 'assistant',
      lifecycleStatus: 'IN_PROGRESS',
      lifecycleAttemptId,
    },
    data: { lifecycleStatus: 'FAILED' },
  })
}

export async function finalizeChatTurn(
  input: FinalizeChatTurnInput
): Promise<FinalizeChatTurnResult> {
  const finalizedAt = input.now ?? new Date()
  const monthStart = getZurichMonthStart(finalizedAt)
  const credits =
    input.rawCreditsUsed === null
      ? null
      : roundChatUsageCredits(input.rawCreditsUsed)

  return withTransaction(async (tx) => {
    const thread = await tx.chatThread.findFirst({
      where: {
        id: input.threadId,
        chatbotId: input.chatbotId,
        chatbot: { ownerId: input.ownerId },
      },
      select: { id: true },
    })
    if (!thread) {
      throw new ChatTurnConflictError()
    }

    await lockChatTurnParent(tx, input.threadId, input.parentId)

    if (
      input.lifecycleAttemptId === null &&
      Array.isArray(input.content) &&
      input.content.length === 0
    ) {
      await tx.chatMessage.deleteMany({
        where: {
          id: input.assistantMessageId,
          threadId: input.threadId,
          role: 'assistant',
          lifecycleStatus: 'IN_PROGRESS',
          lifecycleAttemptId: null,
        },
      })
      return { outcome: 'empty', creditsUsed: null }
    }

    const messageData = {
      parentId: input.parentId,
      content: input.content,
      chatMode: input.chatMode,
      modelId: input.modelId,
      reasoningEffort: input.reasoningEffort,
      reasoningContent: input.reasoningContent,
      creditsUsed: credits,
      lifecycleStatus: 'COMPLETED' as const,
      lifecycleAttemptId: null,
    }
    const completed =
      input.lifecycleAttemptId === null
        ? await tx.chatMessage.updateMany({
            where: {
              id: input.assistantMessageId,
              threadId: input.threadId,
              role: 'assistant',
              lifecycleStatus: 'IN_PROGRESS',
              lifecycleAttemptId: null,
            },
            data: messageData,
          })
        : await tx.chatMessage.updateMany({
            where: {
              id: input.assistantMessageId,
              threadId: input.threadId,
              role: 'assistant',
              lifecycleStatus: { in: ['IN_PROGRESS', 'FAILED'] },
              lifecycleAttemptId: input.lifecycleAttemptId,
            },
            data: messageData,
          })
    if (completed.count === 0) {
      const existing = await tx.chatMessage.findUnique({
        where: { id: input.assistantMessageId },
        select: {
          role: true,
          threadId: true,
          lifecycleStatus: true,
          creditsUsed: true,
          thread: {
            select: {
              chatbotId: true,
              chatbot: { select: { ownerId: true } },
            },
          },
        },
      })
      if (
        existing?.role === 'assistant' &&
        existing.threadId === input.threadId &&
        existing.lifecycleStatus === 'COMPLETED' &&
        existing.thread.chatbotId === input.chatbotId &&
        existing.thread.chatbot.ownerId === input.ownerId
      ) {
        return {
          outcome: 'duplicate',
          creditsUsed: existing.creditsUsed?.toNumber() ?? null,
        }
      }
      throw new ChatTurnConflictError()
    }

    if (credits !== null) {
      const effectiveUsage = await getEffectiveChatAccountUsage(tx, {
        ownerId: input.ownerId,
        usageClass: input.usageClass,
        monthStart,
      })
      if (!effectiveUsage && isChatAccountUsageEnforcementEnabled()) {
        throw new Error('Chat account usage is not configured')
      }

      if (effectiveUsage) {
        await tx.chatAccountUsage.upsert({
          where: {
            ownerId_usageClass_monthStart: {
              ownerId: input.ownerId,
              usageClass: input.usageClass,
              monthStart,
            },
          },
          create: {
            ownerId: input.ownerId,
            usageClass: input.usageClass,
            monthStart,
            budgetCredits: effectiveUsage.budgetCredits,
            usedCredits: credits,
          },
          update: {
            usedCredits: { increment: credits },
          },
        })
      }
    }

    await tx.chatThread.update({
      where: { id: input.threadId },
      data: { updatedAt: finalizedAt },
    })

    return {
      outcome: 'completed',
      creditsUsed: credits?.toNumber() ?? null,
    }
  })
}
