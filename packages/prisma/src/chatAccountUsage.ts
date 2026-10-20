import { Prisma, type ChatUsageClass, type PrismaClient } from './client.js'

type ChatAccountUsageReader = Pick<PrismaClient, 'chatAccountUsage'>

export type EffectiveChatAccountUsage = {
  monthStart: Date
  budgetCredits: Prisma.Decimal
  usedCredits: Prisma.Decimal
}

export async function getEffectiveChatAccountUsage(
  prisma: ChatAccountUsageReader,
  args: {
    ownerId: string
    usageClass: ChatUsageClass
    monthStart: Date
  }
): Promise<EffectiveChatAccountUsage | null> {
  const usage = await prisma.chatAccountUsage.findFirst({
    where: {
      ownerId: args.ownerId,
      usageClass: args.usageClass,
      monthStart: { lte: args.monthStart },
    },
    orderBy: { monthStart: 'desc' },
    select: {
      monthStart: true,
      budgetCredits: true,
      usedCredits: true,
    },
  })

  if (!usage) {
    return null
  }

  const isCurrentMonth =
    usage.monthStart.getTime() === args.monthStart.getTime()

  return {
    monthStart: args.monthStart,
    budgetCredits: usage.budgetCredits,
    usedCredits: isCurrentMonth ? usage.usedCredits : new Prisma.Decimal(0),
  }
}
