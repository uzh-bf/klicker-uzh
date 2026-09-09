import * as DB from '@klicker-uzh/prisma/client'
import { Prisma, type PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  ChatbotAuthoringRevision,
  ChatbotAuthoringRevisionProjection,
  ChatbotStandardModeConfigInput,
} from '@klicker-uzh/types'
import {
  CHAT_BASE_MODEL_ID,
  getChatModelAutoPolicyIssues,
  getChatModelBasePolicyIssues,
  normalizeChatbotStandardModeConfig,
  parseChatbotStandardModeConfigInput,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { z } from 'zod'
import type { Context, ContextWithUser } from '../lib/context.js'
import {
  isFeatureFlagEnabled,
  requireFeatureFlagAccess,
} from '../lib/featureFlags.js'
import {
  type ChatbotCreditPolicy,
  MAX_SIGNED_INT32,
  normalizeAndValidateCreditPolicy,
} from './chatbotCreditPolicy.js'

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
    }

    for (const issue of getChatModelBasePolicyIssues(models)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        ...issue,
      })
    }
    for (const issue of getChatModelAutoPolicyIssues(models)) {
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
    id: 'gpt-5.5',
    deploymentId: 'gpt-5.5',
    name: 'GPT-5.5',
    description: 'OpenAI frontier reasoning model',
    fallback: false,
    supportsReasoning: true,
    usesResponsesApi: true,
    supportedReasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    maxOutputTokens: 4096,
    apiVersion: 'preview',
    cost: { input: 5.0, output: 30.0 },
  },
  {
    id: 'gpt-5.4',
    deploymentId: 'gpt-5.4',
    name: 'GPT-5.4',
    description: 'OpenAI frontier reasoning model',
    fallback: false,
    supportsReasoning: true,
    usesResponsesApi: true,
    supportedReasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    maxOutputTokens: 4096,
    apiVersion: 'preview',
    cost: { input: 2.5, output: 15.0 },
  },
  {
    id: 'gpt-5.1',
    deploymentId: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'OpenAI reasoning model',
    fallback: false,
    supportsReasoning: true,
    usesResponsesApi: true,
    supportedReasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high'],
    maxOutputTokens: 4096,
    apiVersion: 'preview',
    cost: { input: 1.25, output: 10.0 },
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
]

export const DEFAULT_CHAT_MODEL_REGISTRY: ChatModelCapability[] =
  parseChatModelRegistry(DEFAULT_CHAT_MODEL_REGISTRY_INPUT)

let cachedChatModelRegistry: ChatModelCapability[] | null = null

function dedupeStrings(values: readonly string[]) {
  return Array.from(new Set(values))
}

const CHATBOT_DISCLAIMER_TITLE_MAX_LENGTH = 160
const CHATBOT_DISCLAIMER_INTRO_MAX_LENGTH = 10_000
const BASIC_DISCLAIMER_MARKDOWN_NODES = new Set([
  'root',
  'paragraph',
  'text',
  'strong',
  'emphasis',
  'list',
  'listItem',
  'break',
])
const disclaimerMarkdownParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)

function chatbotError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}

function normalizeDisclaimerText(value: string) {
  return value.replace(/\r\n?/g, '\n').trim()
}

function validateDisclaimerContent(title: string, introText: string) {
  if (title.length < 1 || title.length > CHATBOT_DISCLAIMER_TITLE_MAX_LENGTH) {
    throw chatbotError(
      'Disclaimer title must be between 1 and 160 characters long',
      'BAD_USER_INPUT'
    )
  }
  if (
    introText.length < 1 ||
    introText.length > CHATBOT_DISCLAIMER_INTRO_MAX_LENGTH
  ) {
    throw chatbotError(
      'Disclaimer introduction must be between 1 and 10000 characters long',
      'BAD_USER_INPUT'
    )
  }

  const nodes = [
    disclaimerMarkdownParser.parse(introText) as {
      type: string
      checked?: boolean | null
      children?: unknown[]
    },
  ]
  while (nodes.length > 0) {
    const node = nodes.pop()
    if (!node) continue

    if (
      !BASIC_DISCLAIMER_MARKDOWN_NODES.has(node.type) ||
      (node.type === 'listItem' &&
        node.checked !== null &&
        node.checked !== undefined)
    ) {
      throw chatbotError(
        'Disclaimer introduction contains unsupported Markdown',
        'BAD_USER_INPUT'
      )
    }

    for (const child of node.children ?? []) {
      if (typeof child === 'object' && child !== null && 'type' in child) {
        nodes.push(
          child as {
            type: string
            checked?: boolean | null
            children?: unknown[]
          }
        )
      }
    }
  }
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
  const activeModelIds = new Set(
    getChatModelRegistry().map((model) => model.id)
  )
  for (const [modelId, rawEfforts] of Object.entries(
    rawConfig as Record<string, unknown>
  )) {
    if (!activeModelIds.has(modelId)) continue
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

export async function getManageChatModelRegistry(ctx: ContextWithUser) {
  await requireFeatureFlagAccess(ctx, 'ai-beta')
  return getChatModelRegistry()
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
      course: { deletionRequestedAt: null },
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
  systemPrompts: true,
  standardModeConfig: true,
  draftConfig: true,
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
  disclaimerId: true,
  revisionStatus: true,
  revisionVersion: true,
  creditResetPeriodChangedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChatbotSelect

type ChatbotWithOwnerCourse = {
  id: string
  ownerId?: string
  name: string
  description: string | null
  avatar: string | null
  systemPrompts: unknown
  standardModeConfig: unknown
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel: unknown
  creditInitialCredits: number
  creditResetPeriod: DB.CreditResetPeriod
  creditResetAmount: number
  creditMaxCredits: number
  status: DB.ChatbotStatus
  publicationUseCase: string | null
  expectedStudentCount: number | null
  reviewComment: string | null
  publishedAt: Date | null
  draftConfig: unknown
  revisionStatus: DB.ChatbotStatus | null
  revisionVersion: number
  disclaimerId: string | null
  creditResetPeriodChangedAt: Date | null
  course: { id: string; name: string } | null
}

function resolveLegacyFixedModelId(allowedModelIds: readonly string[]) {
  const registry = getChatModelRegistry()
  const activeModelIds = new Set(registry.map((model) => model.id))
  const normalized = dedupeStrings(allowedModelIds).filter((modelId) =>
    activeModelIds.has(modelId)
  )
  const candidates =
    normalized.length > 0
      ? registry.filter((model) => normalized.includes(model.id))
      : allowedModelIds.length === 0
        ? registry
        : registry.filter((model) => model.id === CHAT_BASE_MODEL_ID)

  const configuredPrimary = process.env.CHAT_PRIMARY_MODEL_ID
  const defaultPrimary = candidates.find((model) => !model.fallback)
  return (
    candidates.find((model) => model.id === configuredPrimary)?.id ??
    defaultPrimary?.id ??
    candidates[0]?.id ??
    CHAT_BASE_MODEL_ID
  )
}

function normalizeAllowedModelIds(
  allowedModelIds: string[],
  modelSelection: boolean,
  resolveLegacyFixedPolicy: boolean
) {
  if (!modelSelection && resolveLegacyFixedPolicy) {
    return [resolveLegacyFixedModelId(allowedModelIds)]
  }

  const activeModelIds = new Set(
    getChatModelRegistry().map((model) => model.id)
  )
  const normalized = dedupeStrings(allowedModelIds).filter((modelId) =>
    activeModelIds.has(modelId)
  )

  if (normalized.length > 0 || allowedModelIds.length === 0) {
    return normalized
  }

  // Keep a chatbot with an allow-list made entirely of retired or unknown
  // models on the narrowest current model instead of silently widening it to
  // every active model.
  return [CHAT_BASE_MODEL_ID]
}

function shapeChatbotResponse<T extends ChatbotWithOwnerCourse>(
  chatbot: T,
  options: { resolveLegacyFixedPolicy?: boolean } = {}
) {
  const {
    systemPrompts,
    draftConfig: _draftConfig,
    ...chatbotWithoutSystemPrompts
  } = chatbot
  const resolveLegacyFixedPolicy = options.resolveLegacyFixedPolicy ?? true

  return {
    ...chatbotWithoutSystemPrompts,
    standardModeConfig: normalizeChatbotStandardModeConfig(
      chatbot.standardModeConfig,
      systemPrompts
    ),
    allowedModelIds: normalizeAllowedModelIds(
      chatbot.allowedModelIds,
      chatbot.modelSelection,
      resolveLegacyFixedPolicy
    ),
    allowedReasoningEffortsByModel: parseAllowedReasoningEffortsByModel(
      chatbot.allowedReasoningEffortsByModel
    ),
    authoringRevision: projectAuthoringRevision(chatbot),
    revisionStatus: chatbot.revisionStatus ?? null,
    revisionVersion: chatbot.revisionVersion ?? 0,
    courses: chatbot.course ? [chatbot.course] : [],
  }
}

type ChatbotDisclaimerRevisionSource = {
  id: string
  name: string
  description: string | null
  title: string
  introText: string | null
  mediaUrl: string | null
  mediaType: string | null
}

type ChatbotRevisionRecord = ChatbotWithOwnerCourse & {
  ownerId: string
  disclaimer: ChatbotDisclaimerRevisionSource | null
  owner: { aiFeaturesEnabled: boolean }
}

const chatbotRevisionSelect = {
  ...chatbotOwnerSelect,
  ownerId: true,
  course: { select: { id: true, name: true } },
  disclaimer: {
    select: {
      id: true,
      name: true,
      description: true,
      title: true,
      introText: true,
      mediaUrl: true,
      mediaType: true,
    },
  },
  owner: { select: { aiFeaturesEnabled: true } },
} satisfies Prisma.ChatbotSelect

type RevisionPrismaClient = PrismaClient | Prisma.TransactionClient

const REVISION_CONFLICT_MESSAGE = 'Chatbot revision changed since it was loaded'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => cloneJson(entry))
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, cloneJson(entry)])
  )
}

function parseStoredRevision(value: unknown): ChatbotAuthoringRevision | null {
  if (!isRecord(value)) return null

  if (typeof value.name !== 'string') return null
  if (value.description !== null && typeof value.description !== 'string') {
    return null
  }
  if (value.avatar !== null && typeof value.avatar !== 'string') return null
  if (
    value.standardModeConfig !== null &&
    value.standardModeConfig !== undefined &&
    !isRecord(value.standardModeConfig)
  ) {
    return null
  }
  if (typeof value.modelSelection !== 'boolean') return null
  if (
    !Array.isArray(value.allowedModelIds) ||
    value.allowedModelIds.some((modelId) => typeof modelId !== 'string')
  ) {
    return null
  }

  let allowedReasoningEffortsByModel: Record<string, string[]> | null = null
  if (
    value.allowedReasoningEffortsByModel !== null &&
    value.allowedReasoningEffortsByModel !== undefined
  ) {
    if (!isRecord(value.allowedReasoningEffortsByModel)) return null
    const entries = Object.entries(value.allowedReasoningEffortsByModel)
    if (
      entries.some(
        ([, efforts]) =>
          !Array.isArray(efforts) ||
          efforts.some((effort) => typeof effort !== 'string')
      )
    ) {
      return null
    }
    allowedReasoningEffortsByModel = Object.fromEntries(
      entries.map(([modelId, efforts]) => [modelId, [...(efforts as string[])]])
    )
  }

  const creditValues = [
    value.creditInitialCredits,
    value.creditResetAmount,
    value.creditMaxCredits,
  ]
  if (
    creditValues.some(
      (credit) => typeof credit !== 'number' || !Number.isInteger(credit)
    )
  ) {
    return null
  }
  if (
    typeof value.creditResetPeriod !== 'string' ||
    !Object.values(DB.CreditResetPeriod).includes(
      value.creditResetPeriod as DB.CreditResetPeriod
    )
  ) {
    return null
  }

  const nullableStringFields = [
    value.disclaimerTitle,
    value.disclaimerIntroText,
    value.publicationUseCase,
  ]
  if (
    nullableStringFields.some(
      (field) => field !== null && typeof field !== 'string'
    )
  ) {
    return null
  }
  if (
    value.expectedStudentCount !== null &&
    value.expectedStudentCount !== undefined &&
    (typeof value.expectedStudentCount !== 'number' ||
      !Number.isInteger(value.expectedStudentCount))
  ) {
    return null
  }
  if (
    value.disclaimerId !== null &&
    value.disclaimerId !== undefined &&
    typeof value.disclaimerId !== 'string'
  ) {
    return null
  }

  return {
    name: value.name,
    description: value.description,
    avatar: value.avatar,
    standardModeConfig:
      value.standardModeConfig === null ||
      value.standardModeConfig === undefined
        ? null
        : (cloneJson(
            value.standardModeConfig
          ) as ChatbotAuthoringRevision['standardModeConfig']),
    modelSelection: value.modelSelection,
    allowedModelIds: [...value.allowedModelIds] as string[],
    allowedReasoningEffortsByModel,
    creditInitialCredits: value.creditInitialCredits as number,
    creditResetPeriod: value.creditResetPeriod as DB.CreditResetPeriod,
    creditResetAmount: value.creditResetAmount as number,
    creditMaxCredits: value.creditMaxCredits as number,
    disclaimerTitle: value.disclaimerTitle as string | null,
    disclaimerIntroText: value.disclaimerIntroText as string | null,
    publicationUseCase: value.publicationUseCase as string | null,
    expectedStudentCount:
      value.expectedStudentCount === undefined
        ? null
        : (value.expectedStudentCount as number | null),
    disclaimerId:
      value.disclaimerId === undefined
        ? null
        : (value.disclaimerId as string | null),
  }
}

function buildRevisionFromLive(
  chatbot: ChatbotRevisionRecord
): ChatbotAuthoringRevision {
  return {
    name: chatbot.name,
    description: chatbot.description,
    avatar: chatbot.avatar,
    // Keep the persisted representation intact. The owner projection applies
    // the legacy display fallback without rewriting the live configuration.
    standardModeConfig: cloneJson(
      chatbot.standardModeConfig
    ) as ChatbotAuthoringRevision['standardModeConfig'],
    modelSelection: chatbot.modelSelection,
    allowedModelIds: [...chatbot.allowedModelIds],
    allowedReasoningEffortsByModel: cloneJson(
      chatbot.allowedReasoningEffortsByModel
    ) as ChatbotAuthoringRevision['allowedReasoningEffortsByModel'],
    creditInitialCredits: chatbot.creditInitialCredits,
    creditResetPeriod: chatbot.creditResetPeriod,
    creditResetAmount: chatbot.creditResetAmount,
    creditMaxCredits: chatbot.creditMaxCredits,
    disclaimerTitle: chatbot.disclaimer?.title ?? null,
    disclaimerIntroText: chatbot.disclaimer?.introText ?? null,
    publicationUseCase: chatbot.publicationUseCase,
    expectedStudentCount: chatbot.expectedStudentCount,
    disclaimerId: chatbot.disclaimer?.id ?? chatbot.disclaimerId,
  }
}

function revisionProjection(
  chatbot: ChatbotWithOwnerCourse,
  revision: ChatbotAuthoringRevision,
  status: DB.ChatbotStatus,
  version: number,
  reviewComment: string | null
): ChatbotAuthoringRevisionProjection {
  const { disclaimerId: _disclaimerId, ...safeRevision } = revision
  const reasoningEntries = parseAllowedReasoningEffortsByModel(
    revision.allowedReasoningEffortsByModel
  )

  return {
    ...safeRevision,
    standardModeConfig: normalizeChatbotStandardModeConfig(
      revision.standardModeConfig,
      chatbot.systemPrompts
    ),
    allowedReasoningEffortsByModel:
      reasoningEntries.length > 0
        ? Object.fromEntries(
            reasoningEntries.map(({ modelId, efforts }) => [modelId, efforts])
          )
        : null,
    version,
    status,
    reviewComment,
    chatbotId: chatbot.id,
  }
}

function projectAuthoringRevision(
  chatbot: ChatbotWithOwnerCourse
): ChatbotAuthoringRevisionProjection | null {
  if (chatbot.draftConfig === null || chatbot.draftConfig === undefined) {
    return null
  }
  const revision = parseStoredRevision(chatbot.draftConfig)
  if (!revision) return null

  return revisionProjection(
    chatbot,
    revision,
    chatbot.revisionStatus ?? DB.ChatbotStatus.DRAFT,
    chatbot.revisionVersion ?? 0,
    chatbot.reviewComment ?? null
  )
}

async function readChatbotRevision(
  prisma: RevisionPrismaClient,
  chatbotId: string,
  ownerId?: string
): Promise<ChatbotRevisionRecord | null> {
  return (await prisma.chatbot.findFirst({
    where: ownerId ? { id: chatbotId, ownerId } : { id: chatbotId },
    select: chatbotRevisionSelect,
  })) as ChatbotRevisionRecord | null
}

async function lockChatbotRevision(
  prisma: Prisma.TransactionClient,
  chatbotId: string
) {
  await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "public"."Chatbot" WHERE "id" = ${chatbotId}::uuid FOR UPDATE`
  )
}

function assertExpectedRevisionVersion(
  currentVersion: number,
  expectedRevisionVersion: number | null | undefined
) {
  if (
    typeof expectedRevisionVersion !== 'number' ||
    !Number.isInteger(expectedRevisionVersion) ||
    expectedRevisionVersion < 0 ||
    currentVersion !== expectedRevisionVersion
  ) {
    throw chatbotError(REVISION_CONFLICT_MESSAGE, 'CHATBOT_EDIT_CONFLICT')
  }
}

function assertSaveRevisionVersion(
  chatbot: ChatbotRevisionRecord,
  expectedVersion: number | null | undefined
) {
  if (
    expectedVersion == null &&
    (chatbot.status === DB.ChatbotStatus.DRAFT ||
      chatbot.status === DB.ChatbotStatus.REJECTED) &&
    chatbot.draftConfig === null
  )
    return
  assertExpectedRevisionVersion(chatbot.revisionVersion, expectedVersion)
}

function assertRevisionEditable(chatbot: ChatbotRevisionRecord) {
  if (
    chatbot.status === DB.ChatbotStatus.PAUSED ||
    chatbot.status === DB.ChatbotStatus.PENDING_APPROVAL ||
    chatbot.revisionStatus === DB.ChatbotStatus.PAUSED ||
    chatbot.revisionStatus === DB.ChatbotStatus.PENDING_APPROVAL
  ) {
    throw chatbotError(
      'Chatbot revision is not editable in its current status',
      'CHATBOT_NOT_EDITABLE'
    )
  }
  if (
    ![
      DB.ChatbotStatus.DRAFT,
      DB.ChatbotStatus.REJECTED,
      DB.ChatbotStatus.PUBLISHED,
    ].includes(chatbot.status)
  ) {
    throw chatbotError(
      'Chatbot revision is not editable in its current status',
      'CHATBOT_NOT_EDITABLE'
    )
  }
}

function isLegacyPendingRevision(chatbot: ChatbotRevisionRecord) {
  return (
    chatbot.status === DB.ChatbotStatus.PENDING_APPROVAL &&
    chatbot.revisionStatus === null &&
    chatbot.revisionVersion === 0 &&
    chatbot.draftConfig === null
  )
}

function getRevisionSnapshot(chatbot: ChatbotRevisionRecord) {
  const snapshot =
    chatbot.draftConfig === null || chatbot.draftConfig === undefined
      ? buildRevisionFromLive(chatbot)
      : parseStoredRevision(chatbot.draftConfig)
  if (!snapshot) {
    throw chatbotError(
      'Saved chatbot revision is invalid and must be edited again',
      'BAD_USER_INPUT'
    )
  }
  return snapshot
}

function revisionInput(revision: ChatbotAuthoringRevision) {
  return cloneJson(revision) as ChatbotAuthoringRevision
}

function revisionSaveStatus(chatbot: ChatbotRevisionRecord) {
  return chatbot.revisionStatus === DB.ChatbotStatus.REJECTED
    ? DB.ChatbotStatus.REJECTED
    : DB.ChatbotStatus.DRAFT
}

function revisionLiveData(
  revision: ChatbotAuthoringRevision
): Prisma.ChatbotUncheckedUpdateInput {
  return {
    name: revision.name,
    description: revision.description,
    avatar: revision.avatar,
    standardModeConfig:
      revision.standardModeConfig === null
        ? Prisma.JsonNull
        : (revision.standardModeConfig as PrismaJson.PrismaChatbotStandardModeConfig),
    modelSelection: revision.modelSelection,
    allowedModelIds: revision.allowedModelIds,
    allowedReasoningEffortsByModel:
      revision.allowedReasoningEffortsByModel === null
        ? Prisma.JsonNull
        : (revision.allowedReasoningEffortsByModel as Prisma.InputJsonValue),
    creditInitialCredits: revision.creditInitialCredits,
    creditResetPeriod: revision.creditResetPeriod,
    creditResetAmount: revision.creditResetAmount,
    creditMaxCredits: revision.creditMaxCredits,
    publicationUseCase: revision.publicationUseCase,
    expectedStudentCount: revision.expectedStudentCount,
    disclaimerId: revision.disclaimerId,
  }
}

async function saveRevisionSnapshot(
  tx: Prisma.TransactionClient,
  chatbot: ChatbotRevisionRecord,
  revision: ChatbotAuthoringRevision,
  status: DB.ChatbotStatus = revisionSaveStatus(chatbot),
  reviewComment: string | null | undefined = undefined,
  liveStatus: DB.ChatbotStatus | undefined = undefined,
  retainRevision = true
) {
  await tx.chatbot.update({
    where: { id: chatbot.id },
    data: {
      ...(chatbot.status !== DB.ChatbotStatus.PUBLISHED
        ? revisionLiveData(revision)
        : {}),
      draftConfig: retainRevision ? revisionInput(revision) : Prisma.JsonNull,
      revisionStatus: retainRevision ? status : null,
      revisionVersion: { increment: 1 },
      ...(liveStatus === undefined ? {} : { status: liveStatus }),
      ...(reviewComment === undefined ? {} : { reviewComment }),
    },
  })

  const updated = await readChatbotRevision(tx, chatbot.id)
  if (!updated) return null
  return shapeChatbotResponse(updated)
}

function normalizeRevisionReasoningMap(
  revision: ChatbotAuthoringRevision
): Record<string, string[]> | null {
  if (revision.allowedReasoningEffortsByModel === null) return null
  return Object.fromEntries(
    Object.entries(revision.allowedReasoningEffortsByModel).map(
      ([modelId, efforts]) => [modelId, dedupeStrings(efforts)]
    )
  )
}

function validateRevisionModelConfig(revision: ChatbotAuthoringRevision) {
  const modelRegistry = getChatModelRegistry()
  const modelById = new Map(modelRegistry.map((model) => [model.id, model]))
  const unknownAllowedModelIds = dedupeStrings(revision.allowedModelIds).filter(
    (modelId) => !modelById.has(modelId)
  )
  if (unknownAllowedModelIds.length > 0) {
    throw chatbotError(
      `Unknown model id(s): ${unknownAllowedModelIds.join(', ')}`,
      'BAD_USER_INPUT'
    )
  }

  for (const [modelId, efforts] of Object.entries(
    revision.allowedReasoningEffortsByModel ?? {}
  )) {
    const model = modelById.get(modelId)
    if (!model) {
      throw chatbotError(
        `Unknown model id in reasoning config: ${modelId}`,
        'BAD_USER_INPUT'
      )
    }
    if (!model.supportsReasoning) {
      throw chatbotError(
        `Model ${modelId} does not support configurable reasoning efforts`,
        'BAD_USER_INPUT'
      )
    }
    const unsupportedEfforts = dedupeStrings(efforts).filter(
      (effort) => !model.supportedReasoningEfforts.includes(effort)
    )
    if (unsupportedEfforts.length > 0) {
      throw chatbotError(
        `Unsupported reasoning effort(s) for ${modelId}: ${unsupportedEfforts.join(', ')}`,
        'BAD_USER_INPUT'
      )
    }
    if (dedupeStrings(efforts).length === 0) {
      throw chatbotError(
        `At least one reasoning effort must be configured for model: ${modelId}`,
        'BAD_USER_INPUT'
      )
    }
  }
}

function validateCompleteRevision(
  revision: ChatbotAuthoringRevision,
  requirePublicationFields: boolean
) {
  if (revision.name.trim().length === 0) {
    throw chatbotError('Chatbot name must not be empty', 'BAD_USER_INPUT')
  }

  if (revision.standardModeConfig !== null) {
    try {
      parseChatbotStandardModeConfigInput(revision.standardModeConfig)
    } catch (error) {
      throw chatbotError(
        error instanceof Error
          ? error.message
          : 'Invalid standard mode configuration',
        'BAD_USER_INPUT'
      )
    }
  }

  validateRevisionModelConfig(revision)
  const normalizedPolicy = normalizeAndValidateCreditPolicy({
    creditInitialCredits: revision.creditInitialCredits,
    creditResetPeriod: revision.creditResetPeriod,
    creditResetAmount: revision.creditResetAmount,
    creditMaxCredits: revision.creditMaxCredits,
  })

  const normalizedRevision = {
    ...revision,
    ...normalizedPolicy,
    allowedReasoningEffortsByModel: normalizeRevisionReasoningMap(revision),
  }

  if (requirePublicationFields) {
    const useCase = normalizedRevision.publicationUseCase
    if (
      typeof useCase !== 'string' ||
      useCase.trim().length < 1 ||
      useCase.trim().length > 2000
    ) {
      throw chatbotError(
        'useCase must be between 1 and 2000 characters long',
        'BAD_USER_INPUT'
      )
    }
    if (
      typeof normalizedRevision.expectedStudentCount !== 'number' ||
      !Number.isInteger(normalizedRevision.expectedStudentCount) ||
      normalizedRevision.expectedStudentCount < 1 ||
      normalizedRevision.expectedStudentCount > MAX_SIGNED_INT32
    ) {
      throw chatbotError(
        'expectedStudentCount must be a positive signed 32-bit integer',
        'BAD_USER_INPUT'
      )
    }

    if (
      !normalizedRevision.disclaimerId ||
      typeof normalizedRevision.disclaimerTitle !== 'string' ||
      typeof normalizedRevision.disclaimerIntroText !== 'string'
    ) {
      throw chatbotError(
        'A complete disclaimer is required before publication',
        'CHATBOT_DISCLAIMER_REQUIRED'
      )
    }
    try {
      validateDisclaimerContent(
        normalizeDisclaimerText(normalizedRevision.disclaimerTitle),
        normalizeDisclaimerText(normalizedRevision.disclaimerIntroText)
      )
    } catch {
      throw chatbotError(
        'A complete disclaimer is required before publication',
        'CHATBOT_DISCLAIMER_REQUIRED'
      )
    }

    normalizedRevision.publicationUseCase = useCase.trim()
  }

  return normalizedRevision
}

type RevisionModelPolicyInput = Pick<
  UpdateChatbotModelSettingsArgs,
  'modelSelection' | 'allowedModelIds' | 'allowedReasoningEffortsByModel'
>

type RevisionDisclaimerInput = {
  expectedDisclaimerId?: string | null
  title: string
  introText: string
}

// Omitted sections retain the saved revision. Metadata patches individual fields;
// other supplied sections use their existing complete-section normalization.
export type ChatbotRevisionSaveInput = {
  metadata?: {
    name?: string | null
    description?: string | null
    avatar?: string | null
  } | null
  modelPolicy?: RevisionModelPolicyInput | null
  standardModeConfig?: ChatbotStandardModeConfigInput | null
  creditPolicy?: ChatbotCreditPolicy | null
  disclaimer?: RevisionDisclaimerInput | null
}

export async function saveChatbotRevision(
  args: {
    chatbotId: string
    expectedRevisionVersion: number
    input: ChatbotRevisionSaveInput
  },
  ctx: ContextWithUser
) {
  if (
    !Number.isInteger(args.expectedRevisionVersion) ||
    args.expectedRevisionVersion < 0
  ) {
    throw chatbotError(REVISION_CONFLICT_MESSAGE, 'CHATBOT_EDIT_CONFLICT')
  }
  const { input } = args
  const sections = [
    'metadata',
    'modelPolicy',
    'standardModeConfig',
    'creditPolicy',
    'disclaimer',
  ] as const
  if (
    !input ||
    sections.some((section) => input[section] === null) ||
    !sections.some((section) => input[section] !== undefined)
  ) {
    throw chatbotError(
      'Provide at least one non-null revision section',
      'BAD_USER_INPUT'
    )
  }
  if (
    input.metadata &&
    (input.metadata.name === null ||
      (input.metadata.name === undefined &&
        input.metadata.description === undefined &&
        input.metadata.avatar === undefined))
  ) {
    throw chatbotError(
      'Provide metadata fields; name cannot be null',
      'BAD_USER_INPUT'
    )
  }
  const patch: Partial<ChatbotAuthoringRevision> = {
    ...(input.metadata ? normalizeRevisionMetadata(input.metadata) : {}),
    ...(input.modelPolicy
      ? normalizeRevisionModelPolicy(input.modelPolicy)
      : {}),
    ...(input.standardModeConfig
      ? {
          standardModeConfig: parseRevisionStandardModeConfig(
            input.standardModeConfig
          ),
        }
      : {}),
    ...(input.creditPolicy
      ? normalizeAndValidateCreditPolicy(input.creditPolicy)
      : {}),
  }
  return await stageRevision(args, patch, ctx, input.disclaimer ?? undefined)
}

async function stageRevision(
  args: {
    chatbotId: string
    expectedRevisionVersion?: number | null
  },
  patch: Partial<ChatbotAuthoringRevision>,
  ctx: ContextWithUser,
  disclaimer?: RevisionDisclaimerInput
) {
  await requireFeatureFlagAccess(ctx, 'ai-beta')
  return await ctx.prisma.$transaction(async (tx) => {
    await lockChatbotRevision(tx, args.chatbotId)
    const chatbot = await readChatbotRevision(tx, args.chatbotId, ctx.user.sub)
    if (!chatbot) return null

    assertRevisionEditable(chatbot)
    assertSaveRevisionVersion(chatbot, args.expectedRevisionVersion)

    const current = getRevisionSnapshot(chatbot)
    let next = { ...current, ...patch }
    if (disclaimer) {
      const title = normalizeDisclaimerText(disclaimer.title)
      const introText = normalizeDisclaimerText(disclaimer.introText)
      validateDisclaimerContent(title, introText)
      if (
        args.expectedRevisionVersion == null &&
        disclaimer.expectedDisclaimerId === undefined
      ) {
        throw chatbotError(
          'expectedDisclaimerId must be provided, using null when no disclaimer is linked',
          'BAD_USER_INPUT'
        )
      }
      const currentDisclaimerId = current.disclaimerId ?? chatbot.disclaimerId
      if (
        disclaimer.expectedDisclaimerId !== undefined &&
        disclaimer.expectedDisclaimerId !== currentDisclaimerId
      ) {
        throw chatbotError(
          'Chatbot disclaimer changed since it was loaded',
          'CHATBOT_DISCLAIMER_CONFLICT'
        )
      }

      if (
        current.disclaimerTitle !== title ||
        current.disclaimerIntroText !== introText
      ) {
        const replacement = await tx.chatbotDisclaimer.create({
          data: {
            name: chatbot.disclaimer?.name ?? `${chatbot.name} disclaimer`,
            description: chatbot.disclaimer?.description ?? null,
            title,
            introText,
            mediaUrl: chatbot.disclaimer?.mediaUrl ?? null,
            mediaType: chatbot.disclaimer?.mediaType ?? null,
            ownerId: ctx.user.sub,
          },
          select: { id: true },
        })

        next = {
          ...next,
          disclaimerId: replacement.id,
          disclaimerTitle: title,
          disclaimerIntroText: introText,
        }
      }
    }
    if (next.name === '') {
      throw chatbotError('Chatbot name must not be empty', 'BAD_USER_INPUT')
    }
    return await saveRevisionSnapshot(
      tx,
      chatbot,
      next,
      undefined,
      undefined,
      undefined,
      args.expectedRevisionVersion != null
    )
  })
}

type RevisionExpectedArgs = {
  chatbotId: string
  expectedRevisionVersion?: number | null
}

type AdminRevisionExpectedArgs = {
  id: string
  expectedRevisionVersion?: number | null
}

export async function getChatbotPendingRevision(
  args: { id: string; expectedRevisionVersion?: number | null },
  ctx: ContextWithUser
) {
  if (ctx.user.role !== DB.UserRole.ADMIN) {
    throw new GraphQLError('Not authorized')
  }
  const chatbot = await readChatbotRevision(ctx.prisma, args.id)
  if (!chatbot) return null

  if (
    chatbot.revisionStatus !== DB.ChatbotStatus.PENDING_APPROVAL &&
    !isLegacyPendingRevision(chatbot)
  ) {
    throw chatbotError(
      'Chatbot does not have a pending revision',
      'CHATBOT_REVISION_NOT_PENDING'
    )
  }
  if (
    args.expectedRevisionVersion !== undefined &&
    args.expectedRevisionVersion !== null
  ) {
    if (chatbot.revisionVersion !== args.expectedRevisionVersion) {
      throw chatbotError(REVISION_CONFLICT_MESSAGE, 'CHATBOT_EDIT_CONFLICT')
    }
  }

  return revisionProjection(
    chatbot,
    getRevisionSnapshot(chatbot),
    chatbot.revisionStatus ?? DB.ChatbotStatus.PENDING_APPROVAL,
    chatbot.revisionVersion,
    chatbot.reviewComment
  )
}

function normalizeRevisionMetadata(
  args: NonNullable<ChatbotRevisionSaveInput['metadata']>
) {
  return {
    ...(args.name !== undefined && args.name !== null
      ? { name: args.name }
      : {}),
    ...(args.description !== undefined
      ? { description: args.description }
      : {}),
    ...(args.avatar !== undefined ? { avatar: args.avatar } : {}),
  }
}

export async function updateChatbotRevisionMetadata(
  args: RevisionExpectedArgs &
    NonNullable<ChatbotRevisionSaveInput['metadata']>,
  ctx: ContextWithUser
) {
  return await stageRevision(args, normalizeRevisionMetadata(args), ctx)
}

export async function updateChatbotRevisionModelSettings(
  args: RevisionExpectedArgs & UpdateChatbotModelSettingsArgs,
  ctx: ContextWithUser
) {
  const modelRegistry = getChatModelRegistry()
  const modelById = new Map(modelRegistry.map((model) => [model.id, model]))
  const allowedModelIds = dedupeStrings(args.allowedModelIds)
  const unknownAllowedModelIds = allowedModelIds.filter(
    (modelId) => !modelById.has(modelId)
  )
  if (unknownAllowedModelIds.length > 0) {
    throw chatbotError(
      `Unknown model id(s): ${unknownAllowedModelIds.join(', ')}`,
      'BAD_USER_INPUT'
    )
  }

  const reasoningConfig = args.allowedReasoningEffortsByModel ?? []
  const reasoningMap: Record<string, string[]> = {}
  for (const entry of reasoningConfig) {
    if (reasoningMap[entry.modelId]) {
      throw chatbotError(
        `Duplicate reasoning configuration for model: ${entry.modelId}`,
        'BAD_USER_INPUT'
      )
    }
    const model = modelById.get(entry.modelId)
    if (!model || !model.supportsReasoning) {
      throw chatbotError(
        `Model ${entry.modelId} does not support configurable reasoning efforts`,
        'BAD_USER_INPUT'
      )
    }
    const efforts = dedupeStrings(entry.efforts)
    const unsupported = efforts.filter(
      (effort) => !model.supportedReasoningEfforts.includes(effort)
    )
    if (unsupported.length > 0 || efforts.length === 0) {
      throw chatbotError(
        `Invalid reasoning efforts for model: ${entry.modelId}`,
        'BAD_USER_INPUT'
      )
    }
    reasoningMap[entry.modelId] = efforts
  }

  return await stageRevision(
    args,
    {
      modelSelection: args.modelSelection,
      allowedModelIds,
      allowedReasoningEffortsByModel: reasoningMap,
    },
    ctx
  )
}

function normalizeRevisionModelPolicy(args: RevisionModelPolicyInput) {
  const modelRegistry = getChatModelRegistry()
  const modelById = new Map(modelRegistry.map((model) => [model.id, model]))
  const allowedModelIds = dedupeStrings(args.allowedModelIds)
  if (allowedModelIds.some((modelId) => !modelById.has(modelId))) {
    throw chatbotError('Unknown model id in model policy', 'BAD_USER_INPUT')
  }
  const selectedModels = allowedModelIds
    .map((modelId) => modelById.get(modelId))
    .filter((model): model is ChatModelCapability => model !== undefined)
  if (
    (args.modelSelection && selectedModels.length === 0) ||
    (!args.modelSelection && selectedModels.length !== 1)
  ) {
    throw chatbotError(
      args.modelSelection
        ? 'Participant model selection requires at least one active model'
        : 'Fixed model policy requires exactly one active model',
      'BAD_USER_INPUT'
    )
  }

  const normalizedReasoningConfig = normalizeStrictReasoningConfig(
    args,
    selectedModels,
    modelById
  )
  if (
    !args.modelSelection &&
    selectedModels[0]?.supportsReasoning &&
    normalizedReasoningConfig[0]?.efforts.length !== 1
  ) {
    throw chatbotError(
      `Fixed model policy requires exactly one reasoning effort for model: ${selectedModels[0].id}`,
      'BAD_USER_INPUT'
    )
  }

  return {
    modelSelection: args.modelSelection,
    allowedModelIds,
    allowedReasoningEffortsByModel:
      normalizedReasoningConfig.length > 0
        ? Object.fromEntries(
            normalizedReasoningConfig.map(({ modelId, efforts }) => [
              modelId,
              efforts,
            ])
          )
        : null,
  }
}

export async function updateChatbotRevisionModelPolicy(
  args: RevisionExpectedArgs & UpdateChatbotModelSettingsArgs,
  ctx: ContextWithUser
) {
  return await stageRevision(args, normalizeRevisionModelPolicy(args), ctx)
}

function parseRevisionStandardModeConfig(
  input: ChatbotStandardModeConfigInput
) {
  try {
    return parseChatbotStandardModeConfigInput(input)
  } catch (error) {
    throw chatbotError(
      error instanceof Error
        ? error.message
        : 'Invalid standard mode configuration',
      'BAD_USER_INPUT'
    )
  }
}

export async function updateChatbotRevisionStandardModeConfig(
  args: RevisionExpectedArgs & { config: ChatbotStandardModeConfigInput },
  ctx: ContextWithUser
) {
  return await stageRevision(
    args,
    { standardModeConfig: parseRevisionStandardModeConfig(args.config) },
    ctx
  )
}

export async function updateChatbotRevisionCreditPolicy(
  args: RevisionExpectedArgs & ChatbotCreditPolicy,
  ctx: ContextWithUser
) {
  const policy = normalizeAndValidateCreditPolicy(args)
  return await stageRevision(args, policy, ctx)
}

export async function saveChatbotRevisionDisclaimer(
  args: RevisionExpectedArgs & RevisionDisclaimerInput,
  ctx: ContextWithUser
) {
  return await stageRevision(args, {}, ctx, args)
}

export async function submitChatbotRevision(
  args: RevisionExpectedArgs & {
    useCase: string
    expectedStudentCount: number
  },
  ctx: ContextWithUser
) {
  await requireFeatureFlagAccess(ctx, 'ai-beta')

  return await ctx.prisma.$transaction(async (tx) => {
    await lockChatbotRevision(tx, args.chatbotId)
    const chatbot = await readChatbotRevision(tx, args.chatbotId, ctx.user.sub)
    if (!chatbot) return null
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "public"."User" WHERE "id" = ${ctx.user.sub}::uuid FOR SHARE`
    )
    const owner = await tx.user.findUniqueOrThrow({
      where: { id: ctx.user.sub },
      select: { aiFeaturesEnabled: true },
    })
    if (!owner.aiFeaturesEnabled) {
      throw chatbotError(
        'Account is not approved for chatbot publishing',
        'CHATBOT_PUBLISHING_NOT_AUTHORIZED'
      )
    }
    assertRevisionEditable(chatbot)
    assertSaveRevisionVersion(chatbot, args.expectedRevisionVersion)
    const revision = getRevisionSnapshot(chatbot)
    revision.publicationUseCase = args.useCase
    revision.expectedStudentCount = args.expectedStudentCount
    const completeRevision = validateCompleteRevision(revision, true)
    const currentStatus = chatbot.status
    if (
      currentStatus !== DB.ChatbotStatus.DRAFT &&
      currentStatus !== DB.ChatbotStatus.REJECTED &&
      currentStatus !== DB.ChatbotStatus.PUBLISHED
    ) {
      throw chatbotError(
        `Cannot submit revision from status ${currentStatus}`,
        'CHATBOT_NOT_EDITABLE'
      )
    }

    return await saveRevisionSnapshot(
      tx,
      chatbot,
      completeRevision,
      DB.ChatbotStatus.PENDING_APPROVAL,
      null,
      currentStatus === DB.ChatbotStatus.PUBLISHED
        ? DB.ChatbotStatus.PUBLISHED
        : DB.ChatbotStatus.PENDING_APPROVAL
    )
  })
}

export async function withdrawChatbotRevision(
  args: RevisionExpectedArgs,
  ctx: ContextWithUser
) {
  await requireFeatureFlagAccess(ctx, 'ai-beta')
  return await ctx.prisma.$transaction(async (tx) => {
    await lockChatbotRevision(tx, args.chatbotId)
    const chatbot = await readChatbotRevision(tx, args.chatbotId, ctx.user.sub)
    if (!chatbot) return null
    if (chatbot.revisionStatus !== DB.ChatbotStatus.PENDING_APPROVAL) {
      throw chatbotError(
        'Chatbot revision is not pending approval',
        'CHATBOT_REVISION_NOT_PENDING'
      )
    }
    assertExpectedRevisionVersion(
      chatbot.revisionVersion,
      args.expectedRevisionVersion
    )

    const updated = await tx.chatbot.update({
      where: { id: chatbot.id },
      data: {
        status:
          chatbot.status === DB.ChatbotStatus.PENDING_APPROVAL
            ? DB.ChatbotStatus.DRAFT
            : chatbot.status,
        revisionStatus: DB.ChatbotStatus.DRAFT,
        revisionVersion: { increment: 1 },
      },
    })
    const shaped = await readChatbotRevision(tx, updated.id)
    return shaped ? shapeChatbotResponse(shaped) : null
  })
}

export async function rejectChatbotRevision(
  args: AdminRevisionExpectedArgs & { comment: string },
  ctx: ContextWithUser
) {
  if (ctx.user.role !== DB.UserRole.ADMIN) {
    throw new GraphQLError('Not authorized')
  }

  return await ctx.prisma.$transaction(async (tx) => {
    await lockChatbotRevision(tx, args.id)
    const chatbot = await readChatbotRevision(tx, args.id)
    if (!chatbot) return null
    const comment = args.comment.trim()
    if (!comment) {
      throw chatbotError('Review comment must not be empty', 'BAD_USER_INPUT')
    }
    if (
      chatbot.revisionStatus !== DB.ChatbotStatus.PENDING_APPROVAL &&
      !isLegacyPendingRevision(chatbot)
    ) {
      throw chatbotError(
        'Chatbot revision is not pending approval',
        'CHATBOT_REVISION_NOT_PENDING'
      )
    }
    if (
      !isLegacyPendingRevision(chatbot) ||
      args.expectedRevisionVersion != null
    ) {
      assertExpectedRevisionVersion(
        chatbot.revisionVersion,
        args.expectedRevisionVersion
      )
    }
    const revision = getRevisionSnapshot(chatbot)
    const saved = await tx.chatbot.update({
      where: { id: chatbot.id },
      data: {
        draftConfig: revisionInput(revision),
        revisionStatus: DB.ChatbotStatus.REJECTED,
        revisionVersion: { increment: 1 },
        reviewComment: comment,
        status:
          chatbot.status === DB.ChatbotStatus.PENDING_APPROVAL
            ? DB.ChatbotStatus.REJECTED
            : chatbot.status,
      },
    })
    const shaped = await readChatbotRevision(tx, saved.id)
    return shaped ? shapeChatbotResponse(shaped) : null
  })
}

export async function approveChatbotRevision(
  args: AdminRevisionExpectedArgs,
  ctx: ContextWithUser
) {
  if (ctx.user.role !== DB.UserRole.ADMIN) {
    throw new GraphQLError('Not authorized')
  }

  return await ctx.prisma.$transaction(async (tx) => {
    await lockChatbotRevision(tx, args.id)
    const chatbot = await readChatbotRevision(tx, args.id)
    if (!chatbot) return null
    if (chatbot.status === DB.ChatbotStatus.PAUSED) {
      throw chatbotError(
        'Paused chatbots cannot be approved',
        'CHATBOT_NOT_EDITABLE'
      )
    }
    const legacyPending = isLegacyPendingRevision(chatbot)
    if (
      chatbot.revisionStatus !== DB.ChatbotStatus.PENDING_APPROVAL &&
      !legacyPending
    ) {
      throw chatbotError(
        'Chatbot revision is not pending approval',
        'CHATBOT_REVISION_NOT_PENDING'
      )
    }
    if (!legacyPending || args.expectedRevisionVersion != null) {
      assertExpectedRevisionVersion(
        chatbot.revisionVersion,
        args.expectedRevisionVersion
      )
    }
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "public"."User" WHERE "id" = ${chatbot.ownerId}::uuid FOR SHARE`
    )
    const owner = await tx.user.findUniqueOrThrow({
      where: { id: chatbot.ownerId },
      select: { aiFeaturesEnabled: true },
    })
    if (!owner.aiFeaturesEnabled) {
      throw chatbotError(
        'Account is no longer approved for chatbot publishing',
        'CHATBOT_PUBLISHING_NOT_AUTHORIZED'
      )
    }

    const revision = getRevisionSnapshot(chatbot)
    const completeRevision = validateCompleteRevision(revision, true)
    const periodChanged =
      completeRevision.creditResetPeriod !== chatbot.creditResetPeriod
    const updateData: Prisma.ChatbotUncheckedUpdateInput = {
      ...revisionLiveData(completeRevision),
      draftConfig: Prisma.JsonNull,
      revisionStatus: null,
      revisionVersion: { increment: 1 },
      reviewComment: null,
      status: DB.ChatbotStatus.PUBLISHED,
      publishedAt: chatbot.publishedAt ?? new Date(),
      ...(periodChanged ? { creditResetPeriodChangedAt: new Date() } : {}),
    }

    const updated = await tx.chatbot.update({
      where: { id: chatbot.id },
      data: updateData,
      select: chatbotRevisionSelect,
    })
    return shapeChatbotResponse(updated as ChatbotRevisionRecord)
  })
}

export async function getChatbotPublishingCapability(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.sub },
    select: { aiFeaturesEnabled: true },
  })

  return user.aiFeaturesEnabled
}

export async function getChatbotsInfo(ctx: ContextWithUser) {
  if (!(await isFeatureFlagEnabled(ctx, 'ai-beta'))) return null

  const chatbots = await ctx.prisma.chatbot.findMany({
    where: { ownerId: ctx.user.sub },
    select: {
      ...chatbotOwnerSelect,
      course: { select: { id: true, name: true } },
      disclaimer: {
        select: { id: true, name: true, title: true, introText: true },
      },
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
      knowledgeBases: {
        where: { isEnabled: true },
        select: {
          kb: { select: { id: true, name: true } },
        },
        take: 1,
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
        by: ['chatbotId', 'acceptedDisclaimerId'],
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
  const acceptedCountByDisclaimer = new Map(
    acceptedCounts.map((entry) => [
      `${entry.chatbotId}:${entry.acceptedDisclaimerId}`,
      entry._count._all,
    ])
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
    const acceptedCount = chatbot.disclaimer
      ? (acceptedCountByDisclaimer.get(
          `${chatbot.id}:${chatbot.disclaimer.id}`
        ) ?? 0)
      : 0
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
      enabledKnowledgeBase: chatbot.knowledgeBases[0]?.kb ?? null,
    }
  })
}

type UpdateChatbotModelSettingsArgs = {
  expectedRevisionVersion?: number | null
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
  const result = await updateChatbotRevisionModelSettings(args, ctx)
  if (result && result.status !== DB.ChatbotStatus.PUBLISHED) {
    // Legacy saves return the submitted allowlist before display fallbacks.
    return { ...result, allowedModelIds: dedupeStrings(args.allowedModelIds) }
  }
  return result
}

type UpdateChatbotModelPolicyArgs = UpdateChatbotModelSettingsArgs

function normalizeStrictReasoningConfig(
  args: RevisionModelPolicyInput,
  selectedModels: ChatModelCapability[],
  modelById: Map<string, ChatModelCapability>
) {
  const selectedModelIds = new Set(selectedModels.map((model) => model.id))
  const entries = args.allowedReasoningEffortsByModel ?? []
  const seenModelIds = new Set<string>()
  const normalizedEntries = new Map<string, string[]>()

  for (const entry of entries) {
    const model = modelById.get(entry.modelId)
    if (!model) {
      throw chatbotError(
        `Unknown model id in reasoning config: ${entry.modelId}`,
        'BAD_USER_INPUT'
      )
    }
    if (seenModelIds.has(entry.modelId)) {
      throw chatbotError(
        `Duplicate reasoning configuration for model: ${entry.modelId}`,
        'BAD_USER_INPUT'
      )
    }
    seenModelIds.add(entry.modelId)

    if (!selectedModelIds.has(model.id)) {
      throw chatbotError(
        `Reasoning configuration is only allowed for selected model: ${model.id}`,
        'BAD_USER_INPUT'
      )
    }
    if (!model.supportsReasoning) {
      throw chatbotError(
        `Model ${model.id} does not support configurable reasoning efforts`,
        'BAD_USER_INPUT'
      )
    }

    const supportedEfforts = new Set(model.supportedReasoningEfforts)
    const requestedEfforts = dedupeStrings(entry.efforts)
    const unsupportedEfforts = requestedEfforts.filter(
      (effort) => !supportedEfforts.has(effort)
    )
    if (unsupportedEfforts.length > 0) {
      throw chatbotError(
        `Unsupported reasoning effort(s) for ${model.id}: ${unsupportedEfforts.join(', ')}`,
        'BAD_USER_INPUT'
      )
    }
    if (requestedEfforts.length === 0) {
      throw chatbotError(
        `At least one reasoning effort must be configured for model: ${model.id}`,
        'BAD_USER_INPUT'
      )
    }

    normalizedEntries.set(
      model.id,
      model.supportedReasoningEfforts.filter((effort) =>
        requestedEfforts.includes(effort)
      )
    )
  }

  for (const model of selectedModels) {
    if (model.supportsReasoning && !normalizedEntries.has(model.id)) {
      throw chatbotError(
        `At least one reasoning effort must be configured for model: ${model.id}`,
        'BAD_USER_INPUT'
      )
    }
  }

  return Array.from(normalizedEntries.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([modelId, efforts]) => ({ modelId, efforts }))
}

export async function updateChatbotModelPolicy(
  args: UpdateChatbotModelPolicyArgs,
  ctx: ContextWithUser
) {
  return updateChatbotRevisionModelPolicy(args, ctx)
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
    where: { id: args.courseId, ownerId: ctx.user.sub },
    select: { id: true },
  })
  if (!course) {
    throw new GraphQLError('Course not found')
  }
  if (args.name === '') {
    throw chatbotError('Chatbot name must not be empty', 'BAD_USER_INPUT')
  }

  const modelRegistry = getChatModelRegistry()
  const autoPolicyIssues = getChatModelAutoPolicyIssues(modelRegistry)
  const auto = modelRegistry.find((model) => model.id === 'auto')
  if (autoPolicyIssues.length > 0 || !auto) {
    throw new GraphQLError(
      'Chatbot defaults require exactly one valid non-reasoning ADVANCED Auto model'
    )
  }

  const created = await ctx.prisma.chatbot.create({
    data: {
      name: args.name,
      description: args.description ?? null,
      avatar: args.avatar ?? null,
      status: DB.ChatbotStatus.DRAFT,
      modelSelection: false,
      allowedModelIds: [auto.id],
      allowedReasoningEffortsByModel: Prisma.DbNull,
      owner: { connect: { id: ctx.user.sub } },
      course: { connect: { id: args.courseId } },
      // systemPrompts intentionally left unset (null): the chat runtime
      // composes its Tutor and Explainer platform defaults and exposes Quizzer
      // only when course retrieval is available. Custom modes are added and
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
  expectedRevisionVersion?: number | null
  id: string
  name?: string | null
  description?: string | null
  avatar?: string | null
}

export async function updateChatbot(
  args: UpdateChatbotArgs,
  ctx: ContextWithUser
) {
  return updateChatbotRevisionMetadata({ ...args, chatbotId: args.id }, ctx)
}

export async function updateChatbotCreditPolicy(
  args: {
    chatbotId: string
    expectedRevisionVersion?: number | null
  } & ChatbotCreditPolicy,
  ctx: ContextWithUser
) {
  return updateChatbotRevisionCreditPolicy(args, ctx)
}

type UpdateChatbotStandardModeConfigArgs = {
  expectedRevisionVersion?: number | null
  chatbotId: string
  config: ChatbotStandardModeConfigInput
}

export async function updateChatbotStandardModeConfig(
  args: UpdateChatbotStandardModeConfigArgs,
  ctx: ContextWithUser
) {
  return updateChatbotRevisionStandardModeConfig(args, ctx)
}

type SaveChatbotDisclaimerArgs = {
  expectedRevisionVersion?: number | null
  chatbotId: string
  expectedDisclaimerId?: string | null
  title: string
  introText: string
}

export async function saveChatbotDisclaimer(
  args: SaveChatbotDisclaimerArgs,
  ctx: ContextWithUser
) {
  return saveChatbotRevisionDisclaimer(args, ctx)
}

type RequestChatbotPublicationArgs = {
  expectedRevisionVersion?: number | null
  id: string
  useCase: string
  expectedStudentCount: number
}

export async function requestChatbotPublication(
  args: RequestChatbotPublicationArgs,
  ctx: ContextWithUser
) {
  return submitChatbotRevision({ ...args, chatbotId: args.id }, ctx)
}

export async function approveChatbotPublication(
  args: AdminRevisionExpectedArgs,
  ctx: ContextWithUser
) {
  return approveChatbotRevision(args, ctx)
}

export async function rejectChatbotPublication(
  args: AdminRevisionExpectedArgs & { comment: string },
  ctx: ContextWithUser
) {
  return rejectChatbotRevision(args, ctx)
}
