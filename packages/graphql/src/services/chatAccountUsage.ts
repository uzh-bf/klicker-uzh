import { getEffectiveChatAccountUsage } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import {
  getDefaultChatAccountUsage,
  getZurichMonthReset,
  getZurichMonthStart,
  parseChatUsageCredits,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

export interface ChatAccountUsageLane {
  usageClass: DB.ChatUsageClass
  budgetCredits: number
  usedCredits: number
  remainingCredits: number
  resetAt: Date
}

export interface ChatAccountUsageOverview {
  authorized: boolean
  baseModelUsage: ChatAccountUsageLane
  advancedModelUsage: ChatAccountUsageLane
}

type TargetArgs = {
  ownerId?: string | null
  now?: Date
}

type SetBudgetsArgs = TargetArgs & {
  baseBudgetCredits: number
  advancedBudgetCredits: number
}

function forbiddenError() {
  return new GraphQLError('FORBIDDEN', {
    extensions: { code: 'FORBIDDEN' },
  })
}

function resolveTargetOwnerId(
  ownerId: string | null | undefined,
  ctx: ContextWithUser
): string {
  if (ctx.user.role === DB.UserRole.ADMIN) {
    return ownerId ?? ctx.user.sub
  }

  if (
    ctx.user.role !== DB.UserRole.USER ||
    ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER ||
    (ownerId !== null && ownerId !== undefined && ownerId !== ctx.user.sub)
  ) {
    throw forbiddenError()
  }

  return ctx.user.sub
}

function resolveBudgetOwnerId(
  ownerId: string | null | undefined,
  ctx: ContextWithUser
): string {
  if (ctx.user.role !== DB.UserRole.ADMIN || !ownerId) {
    throw forbiddenError()
  }

  return ownerId
}

function projectLane(
  usageClass: DB.ChatUsageClass,
  usage: Pick<DB.ChatAccountUsage, 'budgetCredits' | 'usedCredits'> | null,
  resetAt: Date
): ChatAccountUsageLane {
  if (!usage) {
    const defaults = getDefaultChatAccountUsage()
    return {
      usageClass,
      ...defaults,
      remainingCredits: 0,
      resetAt,
    }
  }

  const remaining = usage.budgetCredits.minus(usage.usedCredits)
  return {
    usageClass,
    budgetCredits: usage.budgetCredits.toNumber(),
    usedCredits: usage.usedCredits.toNumber(),
    remainingCredits: remaining.isPositive() ? remaining.toNumber() : 0,
    resetAt,
  }
}

function projectOverview({
  authorized,
  baseModelUsage,
  advancedModelUsage,
  resetAt,
}: {
  authorized: boolean
  baseModelUsage: Pick<
    DB.ChatAccountUsage,
    'budgetCredits' | 'usedCredits'
  > | null
  advancedModelUsage: Pick<
    DB.ChatAccountUsage,
    'budgetCredits' | 'usedCredits'
  > | null
  resetAt: Date
}): ChatAccountUsageOverview {
  return {
    authorized,
    baseModelUsage: projectLane(
      DB.ChatUsageClass.BASE,
      baseModelUsage,
      resetAt
    ),
    advancedModelUsage: projectLane(
      DB.ChatUsageClass.ADVANCED,
      advancedModelUsage,
      resetAt
    ),
  }
}

export async function getChatAccountUsage(
  args: TargetArgs,
  ctx: ContextWithUser
): Promise<ChatAccountUsageOverview | null> {
  const ownerId = resolveTargetOwnerId(args.ownerId, ctx)
  const now = args.now ?? new Date()
  const monthStart = getZurichMonthStart(now)
  const owner = await ctx.prisma.user.findUnique({
    where: { id: ownerId },
    select: { aiChatbotPublishingEnabled: true },
  })
  if (!owner) return null

  const [baseModelUsage, advancedModelUsage] = await Promise.all([
    getEffectiveChatAccountUsage(ctx.prisma, {
      ownerId,
      usageClass: DB.ChatUsageClass.BASE,
      monthStart,
    }),
    getEffectiveChatAccountUsage(ctx.prisma, {
      ownerId,
      usageClass: DB.ChatUsageClass.ADVANCED,
      monthStart,
    }),
  ])

  return projectOverview({
    authorized: owner.aiChatbotPublishingEnabled,
    baseModelUsage,
    advancedModelUsage,
    resetAt: getZurichMonthReset(now),
  })
}

export async function setChatAccountUsageBudgets(
  args: SetBudgetsArgs,
  ctx: ContextWithUser
): Promise<ChatAccountUsageOverview | null> {
  const ownerId = resolveBudgetOwnerId(args.ownerId, ctx)
  const baseBudgetCredits = parseChatUsageCredits(args.baseBudgetCredits)
  const advancedBudgetCredits = parseChatUsageCredits(
    args.advancedBudgetCredits
  )
  if (baseBudgetCredits === null || advancedBudgetCredits === null) {
    throw new GraphQLError('Invalid chat usage budget', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }

  const now = args.now ?? new Date()
  const monthStart = getZurichMonthStart(now)
  const resetAt = getZurichMonthReset(now)

  return ctx.prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({
      where: { id: ownerId },
      select: { aiChatbotPublishingEnabled: true },
    })
    if (!owner) return null
    if (!owner.aiChatbotPublishingEnabled) {
      throw new GraphQLError('Chat account usage is not authorized', {
        extensions: { code: 'CHAT_ACCOUNT_USAGE_DISABLED' },
      })
    }

    const baseModelUsage = await tx.chatAccountUsage.upsert({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId,
          usageClass: DB.ChatUsageClass.BASE,
          monthStart,
        },
      },
      update: { budgetCredits: baseBudgetCredits },
      create: {
        ownerId,
        usageClass: DB.ChatUsageClass.BASE,
        monthStart,
        budgetCredits: baseBudgetCredits,
      },
    })
    const advancedModelUsage = await tx.chatAccountUsage.upsert({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId,
          usageClass: DB.ChatUsageClass.ADVANCED,
          monthStart,
        },
      },
      update: { budgetCredits: advancedBudgetCredits },
      create: {
        ownerId,
        usageClass: DB.ChatUsageClass.ADVANCED,
        monthStart,
        budgetCredits: advancedBudgetCredits,
      },
    })

    return projectOverview({
      authorized: true,
      baseModelUsage,
      advancedModelUsage,
      resetAt,
    })
  })
}
