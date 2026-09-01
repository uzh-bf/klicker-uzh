import { getEffectiveChatAccountUsage, prisma } from '@klicker-uzh/prisma'
import { type ChatUsageClass, Prisma } from '@klicker-uzh/prisma/client'
import { getZurichMonthStart } from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { withTransaction } from '../utils/transactions'

const CREDIT_SCALE = 6
const CREDIT_LIMIT = new Prisma.Decimal('1000000000000')
export const CHAT_TURN_ALREADY_COMPLETED_CODE = 'CHAT_TURN_ALREADY_COMPLETED'
export const CHAT_TURN_IN_PROGRESS_CODE = 'CHAT_TURN_IN_PROGRESS'

export type ChatTurnConflictReason =
  | 'invalid_parent'
  | 'assistant_identity_mismatch'
  | 'claim_race'
  | 'finalize_conflict'

export function isChatAccountUsageEnforcementEnabled(): boolean {
  return process.env.CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED === 'true'
}

export class ChatTurnConflictError extends Error {
  readonly code = CHAT_TURN_ALREADY_COMPLETED_CODE
  readonly reason: ChatTurnConflictReason

  constructor(reason: ChatTurnConflictReason) {
    super('Chat turn conflict')
    this.name = 'ChatTurnConflictError'
    this.reason = reason
  }
}

export type FinalizeChatTurnInput = {
  ownerId: string
  chatbotId: string
  participantId: string
  usageClass: ChatUsageClass
  threadId: string
  assistantMessageId: string
  lifecycleAttemptId: string
  parentId: string
  content: Prisma.InputJsonValue
  chatMode: string | null
  modelId: string | null
  reasoningEffort: string | null
  reasoningContent: string | null
  rawCreditsUsed: number | null
  now?: Date
}

export type FinalizeChatTurnResult = {
  outcome: 'completed' | 'duplicate'
  creditsUsed: number | null
}

export type ClaimChatTurnInput = {
  ownerId: string
  chatbotId: string
  participantId: string
  threadId: string
  assistantMessageId: string
  parentId: string
}

export type ClaimChatTurnResult =
  | { outcome: 'claimed'; lifecycleAttemptId: string }
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
  const lifecycleAttemptId = randomUUID()

  return withTransaction(async (tx) => {
    const parent = await tx.chatMessage.findFirst({
      where: {
        id: input.parentId,
        threadId: input.threadId,
        role: 'user',
        lifecycleStatus: 'COMPLETED',
        thread: {
          participantId: input.participantId,
          chatbotId: input.chatbotId,
          chatbot: { ownerId: input.ownerId },
        },
      },
      select: { id: true },
    })
    if (!parent) {
      throw new ChatTurnConflictError('invalid_parent')
    }

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

    // The parent is part of the immutable claim identity. A legacy mismatch
    // fails closed instead of reparenting a client-chosen assistant ID.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reclaimed = await tx.chatMessage.updateMany({
        where: {
          id: input.assistantMessageId,
          threadId: input.threadId,
          parentId: input.parentId,
          role: 'assistant',
          lifecycleStatus: 'FAILED',
          thread: {
            participantId: input.participantId,
            chatbotId: input.chatbotId,
            chatbot: { ownerId: input.ownerId },
          },
        },
        data: {
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

      const existing = await tx.chatMessage.findUnique({
        where: { id: input.assistantMessageId },
        select: {
          role: true,
          threadId: true,
          parentId: true,
          lifecycleStatus: true,
          thread: {
            select: {
              participantId: true,
              chatbotId: true,
              chatbot: { select: { ownerId: true } },
            },
          },
        },
      })
      if (
        existing?.role !== 'assistant' ||
        existing.threadId !== input.threadId ||
        existing.parentId !== input.parentId ||
        existing.thread.participantId !== input.participantId ||
        existing.thread.chatbotId !== input.chatbotId ||
        existing.thread.chatbot.ownerId !== input.ownerId
      ) {
        throw new ChatTurnConflictError('assistant_identity_mismatch')
      }
      if (existing.lifecycleStatus === 'COMPLETED') {
        return { outcome: 'completed', lifecycleAttemptId: null }
      }
      if (existing.lifecycleStatus === 'IN_PROGRESS') {
        return { outcome: 'in_progress', lifecycleAttemptId: null }
      }
    }

    throw new ChatTurnConflictError('claim_race')
  })
}

export async function failChatTurn({
  ownerId,
  chatbotId,
  participantId,
  assistantMessageId,
  threadId,
  parentId,
  lifecycleAttemptId,
}: {
  ownerId: string
  chatbotId: string
  participantId: string
  assistantMessageId: string
  threadId: string
  parentId: string
  lifecycleAttemptId: string
}): Promise<boolean> {
  const failed = await prisma.chatMessage.updateMany({
    where: {
      id: assistantMessageId,
      threadId,
      parentId,
      role: 'assistant',
      lifecycleStatus: 'IN_PROGRESS',
      lifecycleAttemptId,
      thread: {
        participantId,
        chatbotId,
        chatbot: { ownerId },
      },
    },
    data: { lifecycleStatus: 'FAILED' },
  })

  return failed.count === 1
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
    const parent = await tx.chatMessage.findFirst({
      where: {
        id: input.parentId,
        threadId: input.threadId,
        role: 'user',
        lifecycleStatus: 'COMPLETED',
        thread: {
          participantId: input.participantId,
          chatbotId: input.chatbotId,
          chatbot: { ownerId: input.ownerId },
        },
      },
      select: { id: true },
    })
    if (!parent) {
      throw new ChatTurnConflictError('invalid_parent')
    }

    const completed = await tx.chatMessage.updateMany({
      where: {
        id: input.assistantMessageId,
        threadId: input.threadId,
        parentId: input.parentId,
        role: 'assistant',
        lifecycleStatus: { in: ['IN_PROGRESS', 'FAILED'] },
        lifecycleAttemptId: input.lifecycleAttemptId,
        thread: {
          participantId: input.participantId,
          chatbotId: input.chatbotId,
          chatbot: { ownerId: input.ownerId },
        },
      },
      data: {
        content: input.content,
        chatMode: input.chatMode,
        modelId: input.modelId,
        reasoningEffort: input.reasoningEffort,
        reasoningContent: input.reasoningContent,
        creditsUsed: credits,
        lifecycleStatus: 'COMPLETED',
        lifecycleAttemptId: null,
      },
    })
    if (completed.count === 0) {
      const existing = await tx.chatMessage.findUnique({
        where: { id: input.assistantMessageId },
        select: {
          role: true,
          threadId: true,
          parentId: true,
          lifecycleStatus: true,
          creditsUsed: true,
          thread: {
            select: {
              participantId: true,
              chatbotId: true,
              chatbot: { select: { ownerId: true } },
            },
          },
        },
      })
      if (
        existing?.role === 'assistant' &&
        existing.threadId === input.threadId &&
        existing.parentId === input.parentId &&
        existing.lifecycleStatus === 'COMPLETED' &&
        existing.thread.participantId === input.participantId &&
        existing.thread.chatbotId === input.chatbotId &&
        existing.thread.chatbot.ownerId === input.ownerId
      ) {
        return {
          outcome: 'duplicate',
          creditsUsed: existing.creditsUsed?.toNumber() ?? null,
        }
      }
      throw new ChatTurnConflictError('finalize_conflict')
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
