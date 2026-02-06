import { Prisma } from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber()
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export async function getChatbotsInfo(ctx: ContextWithUser) {
  const chatbots = await ctx.prisma.chatbot.findMany({
    where: { ownerId: ctx.user.sub },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      modelSelection: true,
      allowedModelIds: true,
      creditInitialCredits: true,
      creditResetPeriod: true,
      creditResetAmount: true,
      creditMaxCredits: true,
      createdAt: true,
      updatedAt: true,
      course: { select: { id: true, name: true } },
      disclaimer: { select: { id: true, name: true, title: true } },
      mcpConfigurations: {
        select: {
          chatMode: true,
          isEnabled: true,
          priority: true,
          allowedTools: true,
          mcpServer: {
            select: {
              id: true,
              name: true,
              description: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (chatbots.length === 0) {
    return []
  }

  const chatbotIds = chatbots.map((chatbot) => chatbot.id)

  const [creditAggregates, threadAggregates, acceptedCounts, declinedCounts] =
    await Promise.all([
      ctx.prisma.chatUsageCredits.groupBy({
        by: ['chatbotId'],
        where: { chatbotId: { in: chatbotIds } },
        _count: { _all: true },
        _sum: {
          total: true,
          current: true,
          resetCount: true,
        },
        _max: {
          lastResetAt: true,
        },
      }),
      ctx.prisma.chatThread.groupBy({
        by: ['chatbotId'],
        where: { chatbotId: { in: chatbotIds } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      ctx.prisma.chatUsageCredits.groupBy({
        by: ['chatbotId'],
        where: {
          chatbotId: { in: chatbotIds },
          acceptedDisclaimerId: { not: null },
        },
        _count: { _all: true },
      }),
      ctx.prisma.chatUsageCredits.groupBy({
        by: ['chatbotId'],
        where: { chatbotId: { in: chatbotIds }, disclaimerDeclined: true },
        _count: { _all: true },
      }),
    ])

  const creditAggregateById = new Map(
    creditAggregates.map((entry) => [entry.chatbotId, entry])
  )
  const threadAggregateById = new Map(
    threadAggregates.map((entry) => [entry.chatbotId, entry])
  )
  const acceptedCountById = new Map(
    acceptedCounts.map((entry) => [entry.chatbotId, entry._count._all])
  )
  const declinedCountById = new Map(
    declinedCounts.map((entry) => [entry.chatbotId, entry._count._all])
  )

  const messageCountRows = await ctx.prisma.$queryRaw<
    { chatbotId: string; count: bigint }[]
  >(
    Prisma.sql`
      SELECT t."chatbotId", COUNT(m.id) AS count
      FROM "public"."ChatMessage" m
      JOIN "public"."ChatThread" t ON t.id = m."threadId"
      WHERE t."chatbotId" = ANY(${chatbotIds}::uuid[])
      GROUP BY t."chatbotId"
    `
  )
  const messageCountById = new Map(
    messageCountRows.map((row) => [row.chatbotId, Number(row.count)])
  )

  return chatbots.map((chatbot) => {
    const creditAggregate = creditAggregateById.get(chatbot.id)
    const threadAggregate = threadAggregateById.get(chatbot.id)
    const participantCount = creditAggregate?._count._all ?? 0
    const acceptedCount = acceptedCountById.get(chatbot.id) ?? 0
    const declinedCount = declinedCountById.get(chatbot.id) ?? 0
    const pendingCount = Math.max(
      participantCount - acceptedCount - declinedCount,
      0
    )

    const usageSummary = {
      threadCount: threadAggregate?._count._all ?? 0,
      messageCount: messageCountById.get(chatbot.id) ?? 0,
      participantCount,
      lastActivityAt: threadAggregate?._max.updatedAt ?? null,
      totalCredits: toNumber(creditAggregate?._sum.total),
      currentCredits: toNumber(creditAggregate?._sum.current),
      totalResets: creditAggregate?._sum.resetCount ?? 0,
      lastResetAt: creditAggregate?._max.lastResetAt ?? null,
    }

    const disclaimerSummary = chatbot.disclaimer
      ? {
          ...chatbot.disclaimer,
          acceptedCount,
          declinedCount,
          pendingCount,
        }
      : null

    const mcpConfigurations = chatbot.mcpConfigurations.map((config) => ({
      serverId: config.mcpServer.id,
      serverName: config.mcpServer.name,
      serverDescription: config.mcpServer.description,
      serverIsActive: config.mcpServer.isActive,
      chatMode: config.chatMode,
      isEnabled: config.isEnabled,
      priority: config.priority,
      allowedToolsCount: Array.isArray(config.allowedTools)
        ? config.allowedTools.length
        : config.allowedTools
          ? 1
          : 0,
    }))

    return {
      ...chatbot,
      courses: chatbot.course ? [chatbot.course] : [],
      usageSummary,
      disclaimerSummary,
      mcpConfigurations,
    }
  })
}
