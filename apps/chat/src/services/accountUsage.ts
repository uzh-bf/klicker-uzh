import { prisma } from '@klicker-uzh/prisma'
import { type ChatUsageClass, Prisma } from '@klicker-uzh/prisma/client'
import { getZurichMonthStart } from '@klicker-uzh/util'
import { withTransaction } from '../utils/transactions'

const CREDIT_SCALE = 6
const CREDIT_LIMIT = new Prisma.Decimal('1000000000000')
export const CHAT_TURN_ALREADY_COMPLETED_CODE = 'CHAT_TURN_ALREADY_COMPLETED'

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
  outcome: 'created' | 'duplicate'
  creditsUsed: number | null
}

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
  const usage = await prisma.chatAccountUsage.findFirst({
    where: {
      ownerId,
      usageClass,
      monthStart: getZurichMonthStart(now),
      owner: { aiChatbotPublishingEnabled: true },
    },
    select: {
      budgetCredits: true,
      usedCredits: true,
    },
  })

  return Boolean(
    usage?.budgetCredits.greaterThan(0) &&
      usage.usedCredits.lessThan(usage.budgetCredits)
  )
}

export async function isChatTurnKeyClaimed(
  assistantMessageId: string
): Promise<boolean> {
  const message = await prisma.chatMessage.findUnique({
    where: { id: assistantMessageId },
    select: { id: true },
  })
  return message !== null
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

  try {
    return await withTransaction(async (tx) => {
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

      await tx.chatMessage.create({
        data: {
          id: input.assistantMessageId,
          threadId: input.threadId,
          parentId: input.parentId,
          role: 'assistant',
          content: input.content,
          chatMode: input.chatMode,
          modelId: input.modelId,
          reasoningEffort: input.reasoningEffort,
          reasoningContent: input.reasoningContent,
          creditsUsed: credits,
        },
      })

      if (credits !== null) {
        await tx.chatAccountUsage.update({
          where: {
            ownerId_usageClass_monthStart: {
              ownerId: input.ownerId,
              usageClass: input.usageClass,
              monthStart,
            },
          },
          data: {
            usedCredits: { increment: credits },
          },
        })
      }

      await tx.chatThread.update({
        where: { id: input.threadId },
        data: { updatedAt: finalizedAt },
      })

      return {
        outcome: 'created',
        creditsUsed: credits?.toNumber() ?? null,
      }
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const existing = await prisma.chatMessage.findUnique({
      where: { id: input.assistantMessageId },
      select: {
        role: true,
        threadId: true,
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
}

function isUniqueConstraintError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
