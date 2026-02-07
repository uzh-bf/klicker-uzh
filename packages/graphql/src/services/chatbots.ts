import { Prisma } from '@klicker-uzh/prisma/client'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'

const REASONING_EFFORT_OPTIONS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
] as const
type ReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number]

const reasoningEffortSchema = z.enum(REASONING_EFFORT_OPTIONS)
const chatModelSchema = z.object({
  id: z.string().min(1),
  deploymentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  fallback: z.boolean().default(false),
  supportsReasoning: z.boolean().default(false),
  supportedReasoningEfforts: z.array(reasoningEffortSchema).optional(),
  maxOutputTokens: z.number().positive().optional(),
  apiVersion: z.string().min(1),
  cost: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
  }),
})
const chatModelRegistrySchema = z.array(chatModelSchema).min(1)

type RawChatModelConfig = z.infer<typeof chatModelSchema>
type ChatModelCapability = Omit<RawChatModelConfig, 'supportedReasoningEfforts'> & {
  supportedReasoningEfforts: ReasoningEffort[]
}
type ChatbotReasoningConfigEntry = {
  modelId: string
  efforts: ReasoningEffort[]
}

const ALL_REASONING_EFFORTS: ReasoningEffort[] = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
]
const GPT5_REASONING_EFFORTS: ReasoningEffort[] = [
  'minimal',
  'low',
  'medium',
  'high',
]

const DEFAULT_CHAT_MODEL_REGISTRY: ChatModelCapability[] = [
  {
    id: 'gpt-4.1',
    deploymentId: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'OpenAI model',
    fallback: false,
    supportsReasoning: false,
    supportedReasoningEfforts: [],
    apiVersion: 'preview',
    cost: { input: 2.0, output: 8.0 },
  },
  {
    id: 'gpt-5.1',
    deploymentId: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'OpenAI reasoning model',
    fallback: false,
    supportsReasoning: true,
    supportedReasoningEfforts: [...ALL_REASONING_EFFORTS],
    maxOutputTokens: 2048,
    apiVersion: 'preview',
    cost: { input: 1.25, output: 10.0 },
  },
  {
    id: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Small OpenAI model',
    fallback: true,
    supportsReasoning: false,
    supportedReasoningEfforts: [],
    apiVersion: 'preview',
    cost: { input: 0.4, output: 1.6 },
  },
]

let cachedChatModelRegistry: ChatModelCapability[] | null = null

const dedupeReasoningEfforts = (efforts: readonly ReasoningEffort[]) => {
  const seen = new Set<ReasoningEffort>()
  const deduped: ReasoningEffort[] = []
  for (const effort of efforts) {
    if (seen.has(effort)) continue
    seen.add(effort)
    deduped.push(effort)
  }
  return deduped
}

const normalizeReasoningEffortOrder = (efforts: readonly ReasoningEffort[]) => {
  const effortSet = new Set(efforts)
  return REASONING_EFFORT_OPTIONS.filter((effort) => effortSet.has(effort))
}

function getDefaultReasoningEffortsForModel(modelId: string): ReasoningEffort[] {
  const normalizedId = modelId.toLowerCase()
  if (normalizedId.startsWith('gpt-5.1')) {
    return [...ALL_REASONING_EFFORTS]
  }
  if (normalizedId.startsWith('gpt-5')) {
    return [...GPT5_REASONING_EFFORTS]
  }
  return [...ALL_REASONING_EFFORTS]
}

function normalizeChatModel(model: RawChatModelConfig): ChatModelCapability {
  if (!model.supportsReasoning) {
    return { ...model, supportedReasoningEfforts: [] }
  }

  const providedEfforts = model.supportedReasoningEfforts ?? []
  const normalizedEfforts =
    providedEfforts.length > 0
      ? dedupeReasoningEfforts(providedEfforts)
      : getDefaultReasoningEffortsForModel(model.id)

  return {
    ...model,
    supportedReasoningEfforts: normalizeReasoningEffortOrder(normalizedEfforts),
  }
}

export function getChatModelRegistry(): ChatModelCapability[] {
  if (cachedChatModelRegistry) return cachedChatModelRegistry

  const rawRegistry = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!rawRegistry) {
    cachedChatModelRegistry = DEFAULT_CHAT_MODEL_REGISTRY
    return cachedChatModelRegistry
  }

  try {
    cachedChatModelRegistry = chatModelRegistrySchema
      .parse(JSON.parse(rawRegistry))
      .map((model) => normalizeChatModel(model))
    return cachedChatModelRegistry
  } catch (error) {
    console.warn(
      '[graphql] Invalid CHAT_MODEL_REGISTRY_JSON; falling back to built-in defaults.',
      error
    )
    cachedChatModelRegistry = DEFAULT_CHAT_MODEL_REGISTRY
    return cachedChatModelRegistry
  }
}

function parseAllowedReasoningEffortsByModel(
  rawConfig: unknown
): ChatbotReasoningConfigEntry[] {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return []
  }

  const entries: ChatbotReasoningConfigEntry[] = []
  for (const [modelId, rawEfforts] of Object.entries(
    rawConfig as Record<string, unknown>
  )) {
    if (!Array.isArray(rawEfforts)) continue
    const validEfforts = rawEfforts.filter(
      (effort): effort is ReasoningEffort =>
        typeof effort === 'string' &&
        REASONING_EFFORT_OPTIONS.includes(effort as ReasoningEffort)
    )
    const dedupedEfforts = normalizeReasoningEffortOrder(validEfforts)
    if (dedupedEfforts.length === 0) continue

    entries.push({
      modelId,
      efforts: dedupedEfforts,
    })
  }

  return entries.sort((a, b) => a.modelId.localeCompare(b.modelId))
}

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
      allowedReasoningEffortsByModel: true,
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
      allowedReasoningEffortsByModel: parseAllowedReasoningEffortsByModel(
        chatbot.allowedReasoningEffortsByModel
      ),
      courses: chatbot.course ? [chatbot.course] : [],
      usageSummary,
      disclaimerSummary,
      mcpConfigurations,
    }
  })
}

type UpdateChatbotModelSettingsArgs = {
  chatbotId: string
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel?:
    | Array<{ modelId: string; efforts: ReasoningEffort[] }>
    | null
}

export async function updateChatbotModelSettings(
  args: UpdateChatbotModelSettingsArgs,
  ctx: ContextWithUser
) {
  const chatbot = await ctx.prisma.chatbot.findFirst({
    where: {
      id: args.chatbotId,
      ownerId: ctx.user.sub,
    },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      modelSelection: true,
      allowedModelIds: true,
      allowedReasoningEffortsByModel: true,
      creditInitialCredits: true,
      creditResetPeriod: true,
      creditResetAmount: true,
      creditMaxCredits: true,
      createdAt: true,
      updatedAt: true,
      course: { select: { id: true, name: true } },
    },
  })

  if (!chatbot) {
    return null
  }

  const modelRegistry = getChatModelRegistry()
  const modelById = new Map(modelRegistry.map((model) => [model.id, model]))

  const normalizedAllowedModelIds = [...new Set(args.allowedModelIds)]
  const unknownAllowedModelIds = normalizedAllowedModelIds.filter(
    (modelId) => !modelById.has(modelId)
  )
  if (unknownAllowedModelIds.length > 0) {
    throw new Error(
      `Unknown model id(s): ${unknownAllowedModelIds.join(', ')}`
    )
  }

  const normalizedReasoningConfigEntries =
    args.allowedReasoningEffortsByModel ?? []
  const seenReasoningModelIds = new Set<string>()
  const normalizedReasoningMap: Record<string, ReasoningEffort[]> = {}

  for (const entry of normalizedReasoningConfigEntries) {
    const model = modelById.get(entry.modelId)
    if (!model) {
      throw new Error(`Unknown model id in reasoning config: ${entry.modelId}`)
    }
    if (!model.supportsReasoning) {
      throw new Error(
        `Model ${entry.modelId} does not support configurable reasoning efforts`
      )
    }
    if (seenReasoningModelIds.has(entry.modelId)) {
      throw new Error(
        `Duplicate reasoning configuration for model: ${entry.modelId}`
      )
    }
    seenReasoningModelIds.add(entry.modelId)

    const dedupedEfforts = normalizeReasoningEffortOrder(
      dedupeReasoningEfforts(entry.efforts)
    )
    if (dedupedEfforts.length === 0) {
      throw new Error(
        `At least one reasoning effort must be configured for model: ${entry.modelId}`
      )
    }

    const supportedSet = new Set(model.supportedReasoningEfforts)
    const unsupportedEfforts = dedupedEfforts.filter(
      (effort) => !supportedSet.has(effort)
    )
    if (unsupportedEfforts.length > 0) {
      throw new Error(
        `Unsupported reasoning effort(s) for ${entry.modelId}: ${unsupportedEfforts.join(', ')}`
      )
    }

    const isFullModelDefault =
      dedupedEfforts.length === model.supportedReasoningEfforts.length &&
      dedupedEfforts.every((effort) => supportedSet.has(effort))

    if (!isFullModelDefault) {
      normalizedReasoningMap[entry.modelId] = dedupedEfforts
    }
  }

  const updated = await ctx.prisma.chatbot.update({
    where: { id: chatbot.id },
    data: {
      modelSelection: args.modelSelection,
      allowedModelIds: normalizedAllowedModelIds,
      allowedReasoningEffortsByModel:
        Object.keys(normalizedReasoningMap).length > 0
          ? (normalizedReasoningMap as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      modelSelection: true,
      allowedModelIds: true,
      allowedReasoningEffortsByModel: true,
      creditInitialCredits: true,
      creditResetPeriod: true,
      creditResetAmount: true,
      creditMaxCredits: true,
      createdAt: true,
      updatedAt: true,
      course: { select: { id: true, name: true } },
    },
  })

  return {
    ...updated,
    allowedReasoningEffortsByModel: parseAllowedReasoningEffortsByModel(
      updated.allowedReasoningEffortsByModel
    ),
    courses: updated.course ? [updated.course] : [],
  }
}
