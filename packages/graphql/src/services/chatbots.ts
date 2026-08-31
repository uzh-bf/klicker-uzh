import * as DB from '@klicker-uzh/prisma/client'
import { Prisma } from '@klicker-uzh/prisma/client'
import {
  CHAT_BASE_MODEL_ID,
  getChatModelBasePolicyIssues,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { z } from 'zod'
import type { Context, ContextWithUser } from '../lib/context.js'

const chatModelSchema = z
  .object({
    id: z.string().min(1),
    deploymentId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(''),
    fallback: z.boolean().default(false),
    supportsReasoning: z.boolean().default(false),
    usesResponsesApi: z.boolean().optional(),
    supportedReasoningEfforts: z.array(z.string().min(1)).optional(),
    maxOutputTokens: z.number().int().min(1).max(4096),
    apiVersion: z.string().min(1).optional(),
    // Explicit usage class (BASE/ADVANCED). Older external registry JSON that
    // omits the class is conservatively normalized to ADVANCED, never BASE.
    usageClass: z.enum(['BASE', 'ADVANCED']).default('ADVANCED'),
    cost: z.object({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
    }),
  })
  .superRefine((model, ctx) => {
    if (
      model.supportsReasoning &&
      (!model.supportedReasoningEfforts ||
        model.supportedReasoningEfforts.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supportedReasoningEfforts'],
        message: `Model "${model.id}" has supportsReasoning=true but no supportedReasoningEfforts configured.`,
      })
    }
  })
const chatModelRegistrySchema = z
  .array(chatModelSchema)
  .min(1)
  .superRefine((models, ctx) => {
    const seenIds = new Set<string>()

    for (const [index, model] of models.entries()) {
      if (seenIds.has(model.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: `Duplicate model id "${model.id}"`,
        })
      }
      seenIds.add(model.id)

      if (model.id === 'auto' && model.usageClass !== 'ADVANCED') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'usageClass'],
          message: 'Model "auto" must be classified as ADVANCED.',
        })
      }
    }

    for (const issue of getChatModelBasePolicyIssues(models)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        ...issue,
      })
    }
  })

type RawChatModelConfig = z.infer<typeof chatModelSchema>
type ChatModelCapability = Omit<
  RawChatModelConfig,
  'supportedReasoningEfforts' | 'usesResponsesApi'
> & {
  usesResponsesApi: boolean
  supportedReasoningEfforts: string[]
}
type ChatbotReasoningConfigEntry = {
  modelId: string
  efforts: string[]
}

/** Parses and normalizes a raw registry value through the backend consumer. */
export function parseChatModelRegistry(value: unknown): ChatModelCapability[] {
  return chatModelRegistrySchema
    .parse(value)
    .map((model) => normalizeChatModel(model))
}

const DEFAULT_CHAT_MODEL_REGISTRY_INPUT = [
  {
    id: 'auto',
    deploymentId: 'auto-router',
    name: 'Auto Mode',
    description: 'Automatic model selection through the LiteLLM auto router',
    fallback: false,
    supportsReasoning: false,
    usesResponsesApi: true,
    supportedReasoningEfforts: [],
    maxOutputTokens: 4096,
    usageClass: 'ADVANCED',
    apiVersion: 'preview',
    cost: { input: 1.0, output: 5.0 },
  },
  {
    id: 'gpt-5.6-luna',
    deploymentId: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'OpenAI reasoning model',
    fallback: true,
    supportsReasoning: true,
    usesResponsesApi: true,
    supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    maxOutputTokens: 4096,
    usageClass: 'BASE',
    apiVersion: 'preview',
    cost: { input: 0.2, output: 1.2 },
  },
  {
    id: 'gpt-4.1',
    deploymentId: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'OpenAI model',
    fallback: false,
    supportsReasoning: false,
    usesResponsesApi: false,
    supportedReasoningEfforts: [],
    maxOutputTokens: 4096,
    usageClass: 'ADVANCED',
    apiVersion: 'preview',
    cost: { input: 2.0, output: 8.0 },
  },
  {
    id: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Small OpenAI model',
    fallback: false,
    supportsReasoning: false,
    usesResponsesApi: false,
    supportedReasoningEfforts: [],
    maxOutputTokens: 4096,
    usageClass: 'ADVANCED',
    apiVersion: 'preview',
    cost: { input: 0.4, output: 1.6 },
  },
]

export const DEFAULT_CHAT_MODEL_REGISTRY: ChatModelCapability[] =
  parseChatModelRegistry(DEFAULT_CHAT_MODEL_REGISTRY_INPUT)

let cachedChatModelRegistry: ChatModelCapability[] | null = null

function dedupeStrings(values: readonly string[]) {
  return Array.from(new Set(values))
}

function normalizeChatModel(model: RawChatModelConfig): ChatModelCapability {
  const usesResponsesApi = model.usesResponsesApi ?? model.supportsReasoning

  if (!model.supportsReasoning) {
    return { ...model, usesResponsesApi, supportedReasoningEfforts: [] }
  }
  return {
    ...model,
    usesResponsesApi,
    supportedReasoningEfforts: dedupeStrings(
      model.supportedReasoningEfforts ?? []
    ),
  }
}

export function getChatModelRegistry(): ChatModelCapability[] {
  if (cachedChatModelRegistry) return cachedChatModelRegistry

  const rawRegistry = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!rawRegistry) {
    cachedChatModelRegistry = DEFAULT_CHAT_MODEL_REGISTRY
    return cachedChatModelRegistry
  }

  cachedChatModelRegistry = parseChatModelRegistry(JSON.parse(rawRegistry))
  return cachedChatModelRegistry
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
      (effort): effort is string =>
        typeof effort === 'string' && effort.length > 0
    )
    const dedupedEfforts = dedupeStrings(validEfforts)
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

export async function getParticipantCourseChatbots(
  { courseId }: { courseId: string },
  ctx: Context
) {
  // the course overview page is publicly accessible, so anonymous visitors and
  // logged-in lecturers must receive an empty list instead of an auth error
  if (!ctx.user?.sub || ctx.user.role !== DB.UserRole.PARTICIPANT) {
    return []
  }

  const participation = await ctx.prisma.participation.findUnique({
    select: { id: true },
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
      course: { isDeleted: false },
    },
  })

  if (!participation) {
    return []
  }

  const chatbots = await ctx.prisma.chatbot.findMany({
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
    },
    // Participants only see PUBLISHED bots; drafts and in-review bots stay hidden
    // in the course overview (F2, mirrors the chat-app access gate).
    where: {
      courseId,
      course: { isDeleted: false },
      status: DB.ChatbotStatus.PUBLISHED,
    },
  })

  return chatbots.map(({ id, name, description, avatar }) => ({
    id,
    name,
    description,
    avatar,
  }))
}

// Owner-facing column projection shared by every service that returns the
// full (lecturer) Chatbot shape. Keeping it in one place ensures newly added
// owner fields (e.g. lifecycle status) are selected everywhere IChatbot is
// returned, so the GraphQL type never sees a missing non-nullable field.
const chatbotOwnerSelect = {
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
  status: true,
  publicationUseCase: true,
  expectedStudentCount: true,
  reviewComment: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChatbotSelect

type ChatbotWithOwnerCourse = {
  allowedReasoningEffortsByModel: unknown
  course: { id: string; name: string } | null
}

function shapeChatbotResponse<T extends ChatbotWithOwnerCourse>(chatbot: T) {
  return {
    ...chatbot,
    allowedReasoningEffortsByModel: parseAllowedReasoningEffortsByModel(
      chatbot.allowedReasoningEffortsByModel
    ),
    courses: chatbot.course ? [chatbot.course] : [],
  }
}

export async function getChatbotsInfo(ctx: ContextWithUser) {
  const chatbots = await ctx.prisma.chatbot.findMany({
    where: { ownerId: ctx.user.sub, course: { isDeleted: false } },
    select: {
      ...chatbotOwnerSelect,
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
      ...shapeChatbotResponse(chatbot),
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
  allowedReasoningEffortsByModel?: Array<{
    modelId: string
    efforts: string[]
  }> | null
}

export async function updateChatbotModelSettings(
  args: UpdateChatbotModelSettingsArgs,
  ctx: ContextWithUser
) {
  const chatbot = await ctx.prisma.chatbot.findFirst({
    where: {
      id: args.chatbotId,
      ownerId: ctx.user.sub,
      course: { isDeleted: false },
    },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
    },
  })

  if (!chatbot) {
    return null
  }

  const modelRegistry = getChatModelRegistry()
  const modelById = new Map(modelRegistry.map((model) => [model.id, model]))

  const normalizedAllowedModelIds = dedupeStrings(args.allowedModelIds)
  const unknownAllowedModelIds = normalizedAllowedModelIds.filter(
    (modelId) => !modelById.has(modelId)
  )
  if (unknownAllowedModelIds.length > 0) {
    throw new Error(`Unknown model id(s): ${unknownAllowedModelIds.join(', ')}`)
  }

  const seenReasoningModelIds = new Set<string>()
  const normalizedReasoningMap: Record<string, string[]> = {}

  for (const entry of args.allowedReasoningEffortsByModel ?? []) {
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

    const supportedSet = new Set(model.supportedReasoningEfforts)
    const requestedSet = new Set<string>()
    const unsupportedEfforts: string[] = []
    for (const effort of entry.efforts) {
      if (supportedSet.has(effort)) {
        requestedSet.add(effort)
      } else if (!unsupportedEfforts.includes(effort)) {
        unsupportedEfforts.push(effort)
      }
    }
    if (unsupportedEfforts.length > 0) {
      throw new Error(
        `Unsupported reasoning effort(s) for ${entry.modelId}: ${unsupportedEfforts.join(', ')}`
      )
    }
    if (requestedSet.size === 0) {
      throw new Error(
        `At least one reasoning effort must be configured for model: ${entry.modelId}`
      )
    }

    const dedupedEfforts = model.supportedReasoningEfforts.filter((effort) =>
      requestedSet.has(effort)
    )
    const isFullModelDefault =
      dedupedEfforts.length === model.supportedReasoningEfforts.length

    if (!isFullModelDefault) {
      normalizedReasoningMap[entry.modelId] = dedupedEfforts
    }
  }

  const updated = await ctx.prisma.chatbot.update({
    where: { id: chatbot.id, course: { isDeleted: false } },
    data: {
      modelSelection: args.modelSelection,
      allowedModelIds: normalizedAllowedModelIds,
      allowedReasoningEffortsByModel:
        Object.keys(normalizedReasoningMap).length > 0
          ? (normalizedReasoningMap as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
    },
  })

  return shapeChatbotResponse(updated)
}

type CreateChatbotArgs = {
  name: string
  description?: string | null
  avatar?: string | null
  courseId: string
}

export async function createChatbot(
  args: CreateChatbotArgs,
  ctx: ContextWithUser
) {
  // Resource-level authorization: the target course must belong to the
  // requesting lecturer. Pothos already checked authenticate + catalyst; this
  // is the third (execute-time ownership) layer of the auth model.
  const course = await ctx.prisma.course.findFirst({
    where: { id: args.courseId, ownerId: ctx.user.sub, isDeleted: false },
    select: { id: true },
  })
  if (!course) {
    throw new GraphQLError('Course not found')
  }
  if (args.name === '') {
    throw new GraphQLError('Chatbot name must not be empty')
  }

  const luna = getChatModelRegistry().find(
    (model) => model.id === CHAT_BASE_MODEL_ID && model.usageClass === 'BASE'
  )
  if (
    !luna ||
    !luna.supportsReasoning ||
    !luna.supportedReasoningEfforts.includes('low') ||
    !luna.supportedReasoningEfforts.includes('medium')
  ) {
    throw new GraphQLError(
      `Chatbot defaults require the ${CHAT_BASE_MODEL_ID} BASE model with low and medium reasoning support`
    )
  }

  const created = await ctx.prisma.chatbot.create({
    data: {
      name: args.name,
      description: args.description ?? null,
      avatar: args.avatar ?? null,
      status: DB.ChatbotStatus.DRAFT,
      modelSelection: false,
      allowedModelIds: [CHAT_BASE_MODEL_ID],
      allowedReasoningEffortsByModel: {
        [CHAT_BASE_MODEL_ID]: ['low', 'medium'],
      },
      owner: { connect: { id: ctx.user.sub } },
      course: { connect: { id: args.courseId, isDeleted: false } },
      // systemPrompts intentionally left unset (null): when no modes are
      // configured, the chat runtime derives a tutor-only default from
      // DEFAULT_PROMPT (getSupportedChatModes). Custom modes are added and
      // reviewed post-approval — see docs/adr/0021.
    },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
    },
  })

  return shapeChatbotResponse(created)
}

type UpdateChatbotArgs = {
  id: string
  name?: string | null
  description?: string | null
  avatar?: string | null
}

export async function updateChatbot(
  args: UpdateChatbotArgs,
  ctx: ContextWithUser
) {
  // Ownership guard: a failed ownerId-scoped lookup returns null rather than a
  // throw, so a non-owner cannot distinguish "not yours" from "does not exist".
  const existing = await ctx.prisma.chatbot.findFirst({
    where: {
      id: args.id,
      ownerId: ctx.user.sub,
      course: { isDeleted: false },
    },
    select: { id: true },
  })
  if (!existing) {
    return null
  }
  if (args.name === '') {
    throw new GraphQLError('Chatbot name must not be empty')
  }

  const updated = await ctx.prisma.chatbot.update({
    where: { id: existing.id, course: { isDeleted: false } },
    data: {
      // name is a required column, so only overwrite it when a value is given.
      ...(args.name != null ? { name: args.name } : {}),
      // description/avatar are nullable: an explicit null clears them, an
      // omitted (undefined) arg leaves them untouched.
      ...(args.description !== undefined
        ? { description: args.description }
        : {}),
      ...(args.avatar !== undefined ? { avatar: args.avatar } : {}),
    },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
    },
  })

  return shapeChatbotResponse(updated)
}

type RequestChatbotPublicationArgs = {
  id: string
  useCase: string
  expectedStudentCount: number
  proposedCredits: number
}

export async function requestChatbotPublication(
  args: RequestChatbotPublicationArgs,
  ctx: ContextWithUser
) {
  // Ownership/existence first: a non-owner gets null (not found) and never
  // learns anything about the account capability below.
  const chatbot = await ctx.prisma.chatbot.findFirst({
    where: {
      id: args.id,
      ownerId: ctx.user.sub,
      course: { isDeleted: false },
    },
    select: { id: true, status: true },
  })
  if (!chatbot) {
    return null
  }

  if (typeof args.useCase !== 'string') {
    throw new GraphQLError('useCase must be between 1 and 2000 characters long')
  }
  const normalizedUseCase = args.useCase.trim()
  if (normalizedUseCase.length < 1 || normalizedUseCase.length > 2000) {
    throw new GraphQLError('useCase must be between 1 and 2000 characters long')
  }

  const isPositiveSignedInt32 = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 2_147_483_647

  if (!isPositiveSignedInt32(args.expectedStudentCount)) {
    throw new GraphQLError(
      'expectedStudentCount must be a positive signed 32-bit integer'
    )
  }
  if (!isPositiveSignedInt32(args.proposedCredits)) {
    throw new GraphQLError(
      'proposedCredits must be a positive signed 32-bit integer'
    )
  }

  // Account-level capability gate (D1, ADR 0020): read the live User row, never
  // a JWT claim — ops flips this flag out of band after the token was issued.
  const owner = await ctx.prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.sub },
    select: { aiChatbotPublishingEnabled: true },
  })
  if (!owner.aiChatbotPublishingEnabled) {
    throw new GraphQLError('Account is not approved for chatbot publishing')
  }

  // Only a DRAFT or a previously REJECTED bot may (re-)enter review.
  if (
    chatbot.status !== DB.ChatbotStatus.DRAFT &&
    chatbot.status !== DB.ChatbotStatus.REJECTED
  ) {
    throw new GraphQLError(
      `Cannot request publication from status ${chatbot.status}`
    )
  }

  const transition = await ctx.prisma.chatbot.updateMany({
    where: {
      id: chatbot.id,
      ownerId: ctx.user.sub,
      course: { isDeleted: false },
      status: {
        in: [DB.ChatbotStatus.DRAFT, DB.ChatbotStatus.REJECTED],
      },
      owner: { aiChatbotPublishingEnabled: true },
    },
    data: {
      status: DB.ChatbotStatus.PENDING_APPROVAL,
      publicationUseCase: normalizedUseCase,
      expectedStudentCount: args.expectedStudentCount,
      reviewComment: null, // clear any prior rejection note on re-request
      // Proposed credit budget (gated cost class, D2): flat model — initial =
      // reset amount = max = proposedCredits; the reset period keeps its
      // configured value. Student-inert until PUBLISHED (S4 gates access).
      creditInitialCredits: args.proposedCredits,
      creditResetAmount: args.proposedCredits,
      creditMaxCredits: args.proposedCredits,
    },
  })

  if (transition.count === 0) {
    throw new GraphQLError(
      'Chatbot publication request could not be completed because its status or account capability changed concurrently'
    )
  }

  const updated = await ctx.prisma.chatbot.findUniqueOrThrow({
    where: { id: chatbot.id, course: { isDeleted: false } },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
    },
  })

  return shapeChatbotResponse(updated)
}

export async function approveChatbotPublication(
  args: { id: string },
  ctx: ContextWithUser
) {
  // Service-level admin check (D3): the schema layer already gates on asAdmin,
  // but service tests bypass Pothos, so this is the check the admin-authz test
  // exercises.
  if (ctx.user.role !== DB.UserRole.ADMIN) {
    throw new GraphQLError('Not authorized')
  }

  const chatbot = await ctx.prisma.chatbot.findUnique({
    where: { id: args.id, course: { isDeleted: false } },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      // Re-check the owner's account-level publishing capability at approval
      // time (S3 review): the manual queue can sit for days, and ops may revoke
      // aiChatbotPublishingEnabled while a request is pending. Checking only at
      // request time would let an unaware admin publish a bot under an account
      // that no longer holds the capability. See ADR 0020 (two-tier approval).
      owner: { select: { aiChatbotPublishingEnabled: true } },
    },
  })
  if (!chatbot) {
    return null
  }
  if (chatbot.status !== DB.ChatbotStatus.PENDING_APPROVAL) {
    throw new GraphQLError(`Cannot approve from status ${chatbot.status}`)
  }
  if (!chatbot.owner.aiChatbotPublishingEnabled) {
    throw new GraphQLError(
      'Account is no longer approved for chatbot publishing'
    )
  }

  const transition = await ctx.prisma.chatbot.updateMany({
    where: {
      id: chatbot.id,
      status: DB.ChatbotStatus.PENDING_APPROVAL,
      course: { isDeleted: false },
      owner: { aiChatbotPublishingEnabled: true },
    },
    data: {
      status: DB.ChatbotStatus.PUBLISHED,
      // Stamp the first go-live only; a later re-approval keeps the original.
      publishedAt: chatbot.publishedAt ?? new Date(),
      reviewComment: null,
    },
  })
  if (transition.count === 0) {
    throw new GraphQLError(
      'Chatbot approval could not be completed because its status or account capability changed'
    )
  }

  const updated = await ctx.prisma.chatbot.findUniqueOrThrow({
    where: { id: chatbot.id, course: { isDeleted: false } },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
    },
  })

  return shapeChatbotResponse(updated)
}

export async function rejectChatbotPublication(
  args: { id: string; comment: string },
  ctx: ContextWithUser
) {
  if (ctx.user.role !== DB.UserRole.ADMIN) {
    throw new GraphQLError('Not authorized')
  }

  const chatbot = await ctx.prisma.chatbot.findUnique({
    where: { id: args.id, course: { isDeleted: false } },
    select: { id: true, status: true },
  })
  if (!chatbot) {
    return null
  }
  if (args.comment.trim().length === 0) {
    throw new GraphQLError('Review comment must not be empty')
  }
  if (chatbot.status !== DB.ChatbotStatus.PENDING_APPROVAL) {
    throw new GraphQLError(`Cannot reject from status ${chatbot.status}`)
  }

  const transition = await ctx.prisma.chatbot.updateMany({
    where: {
      id: chatbot.id,
      status: DB.ChatbotStatus.PENDING_APPROVAL,
      course: { isDeleted: false },
    },
    data: {
      status: DB.ChatbotStatus.REJECTED,
      reviewComment: args.comment,
    },
  })
  if (transition.count === 0) {
    throw new GraphQLError(
      'Chatbot rejection could not be completed because its status changed'
    )
  }

  const updated = await ctx.prisma.chatbot.findUniqueOrThrow({
    where: { id: chatbot.id, course: { isDeleted: false } },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
    },
  })

  return shapeChatbotResponse(updated)
}
