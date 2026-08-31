import {
  CHAT_BASE_MODEL_ID,
  getChatModelBasePolicyIssues,
} from '@klicker-uzh/util'
import { z } from 'zod'
import { type ReasoningEffort } from '../config/reasoning'

const chatModelSchema = z
  .object({
    id: z.string().min(1),
    deploymentId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(''),
    fallback: z.boolean().default(false),
    supportsReasoning: z.boolean().default(false),
    usesResponsesApi: z.boolean().optional(),
    supportsImageAttachments: z.boolean().default(false),
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
    let hasFallback = false

    for (const [index, model] of models.entries()) {
      if (seenIds.has(model.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: `Duplicate model id "${model.id}"`,
        })
      }
      seenIds.add(model.id)

      if (model.fallback) {
        hasFallback = true
      }

      if (model.id === 'auto' && model.usageClass !== 'ADVANCED') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'usageClass'],
          message: 'Model "auto" must be classified as ADVANCED.',
        })
      }
    }

    if (!hasFallback) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'At least one model with "fallback: true" is required for credit-safe automatic selection.',
      })
    }

    for (const issue of getChatModelBasePolicyIssues(models)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        ...issue,
      })
    }
  })

type RawChatModelConfig = z.infer<typeof chatModelSchema>
export type ReasoningEffortByModel = Record<string, ReasoningEffort[]>
export type ChatModelConfig = Omit<
  RawChatModelConfig,
  'supportedReasoningEfforts' | 'usesResponsesApi'
> & {
  usesResponsesApi: boolean
  supportedReasoningEfforts: ReasoningEffort[]
}

function dedupeStrings(values: readonly string[]) {
  return Array.from(new Set(values))
}

function normalizeChatModelConfig(model: RawChatModelConfig): ChatModelConfig {
  const usesResponsesApi = model.usesResponsesApi ?? model.supportsReasoning

  if (!model.supportsReasoning) {
    return {
      ...model,
      usesResponsesApi,
      supportedReasoningEfforts: [],
    }
  }

  return {
    ...model,
    usesResponsesApi,
    supportedReasoningEfforts: dedupeStrings(
      model.supportedReasoningEfforts ?? []
    ),
  }
}

function parseRegistryValue(value: unknown): ChatModelConfig[] {
  return chatModelRegistrySchema
    .parse(value)
    .map((model) => normalizeChatModelConfig(model))
}

/** Parses and normalizes a raw registry value through the chat consumer. */
export function parseChatModelRegistry(value: unknown): ChatModelConfig[] {
  return parseRegistryValue(value)
}

export const DEFAULT_MODEL_REGISTRY: ChatModelConfig[] = parseRegistryValue([
  {
    id: 'auto',
    deploymentId: 'auto-router',
    name: 'Auto Mode',
    description: 'Automatic model selection through the LiteLLM auto router',
    fallback: false,
    supportsReasoning: false,
    usesResponsesApi: true,
    supportsImageAttachments: true,
    supportedReasoningEfforts: [],
    maxOutputTokens: 4096,
    usageClass: 'ADVANCED',
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
    supportsImageAttachments: true,
    supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    maxOutputTokens: 4096,
    usageClass: 'BASE',
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
    supportsImageAttachments: true,
    supportedReasoningEfforts: [],
    maxOutputTokens: 4096,
    usageClass: 'ADVANCED',
    cost: { input: 2.0, output: 8.0 },
  },
])

let cachedRegistry: ChatModelConfig[] | null = null

export function getChatModelRegistry(): ChatModelConfig[] {
  if (cachedRegistry) return cachedRegistry

  const raw = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!raw) {
    cachedRegistry = DEFAULT_MODEL_REGISTRY
    return cachedRegistry
  }

  cachedRegistry = parseRegistryValue(JSON.parse(raw))
  return cachedRegistry
}

export function parseReasoningEffortByModel(
  rawConfig: unknown
): ReasoningEffortByModel {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return {}
  }

  const result: ReasoningEffortByModel = {}
  for (const [modelId, rawEfforts] of Object.entries(
    rawConfig as Record<string, unknown>
  )) {
    if (!Array.isArray(rawEfforts)) continue
    const validEfforts: ReasoningEffort[] = rawEfforts.filter(
      (effort): effort is ReasoningEffort =>
        typeof effort === 'string' && effort.length > 0
    )

    const dedupedEfforts = dedupeStrings(validEfforts)
    if (dedupedEfforts.length === 0) continue

    result[modelId] = dedupedEfforts
  }

  return result
}

export function getAllowedReasoningEffortsForModel(
  model: Pick<
    ChatModelConfig,
    'id' | 'supportsReasoning' | 'supportedReasoningEfforts'
  >,
  rawConfig: unknown
): ReasoningEffort[] {
  if (!model.supportsReasoning) return []

  const supportedEfforts = dedupeStrings(model.supportedReasoningEfforts)
  if (supportedEfforts.length === 0) return []

  const configuredByModel = parseReasoningEffortByModel(rawConfig)
  const configuredEfforts = configuredByModel[model.id]
  if (!configuredEfforts || configuredEfforts.length === 0) {
    return supportedEfforts
  }

  const allowedSet = new Set(configuredEfforts)
  const intersection = supportedEfforts.filter((effort) =>
    allowedSet.has(effort)
  )

  return intersection.length > 0 ? intersection : supportedEfforts
}

function filterRegistryByAllowList(
  allowedModelIds?: readonly string[]
): ChatModelConfig[] {
  const registry = getChatModelRegistry()
  if (!allowedModelIds || allowedModelIds.length === 0) return registry

  const allowed = new Set(allowedModelIds)
  const filtered = registry.filter((model) => allowed.has(model.id))
  if (filtered.length > 0) return filtered

  // A stored allow-list can outlive every model it names. Keep that chatbot
  // usable through the unconditional base fallback without widening it to all
  // current models.
  const fallbackModelId = getParticipantFallbackModelId()
  return registry.filter((model) => model.id === fallbackModelId)
}

/**
 * Filters the global model registry by a chatbot's allow-list.
 * Empty allowedModelIds means all models are available (backward-compatible
 * default). A stale nonempty list retains only the base fallback.
 */
export function getModelsForChatbot(chatbot: {
  allowedModelIds: string[]
  allowedReasoningEffortsByModel?: unknown
}): ChatModelConfig[] {
  return filterRegistryByAllowList(chatbot.allowedModelIds).map((model) => ({
    ...model,
    supportedReasoningEfforts: getAllowedReasoningEffortsForModel(
      model,
      chatbot.allowedReasoningEffortsByModel
    ),
  }))
}

export function getAutomaticModelId(allowedModelIds?: string[]): string | null {
  const registry = filterRegistryByAllowList(allowedModelIds)
  if (registry.length === 0) return null

  const configuredPrimary = process.env.CHAT_PRIMARY_MODEL_ID

  const defaultPrimary = registry.find((model) => model.fallback === false)

  const primary =
    (configuredPrimary &&
      registry.find((model) => model.id === configuredPrimary)) ||
    defaultPrimary ||
    registry[0]

  if (configuredPrimary && primary.id !== configuredPrimary) {
    console.warn(
      `[chat] CHAT_PRIMARY_MODEL_ID="${configuredPrimary}" is not in the registry; using "${primary.id}".`
    )
  }

  return primary.id
}

export function getParticipantFallbackModelId(): string | null {
  const fallback = getChatModelRegistry().find(
    (model) =>
      model.id === CHAT_BASE_MODEL_ID &&
      model.usageClass === 'BASE' &&
      model.fallback
  )
  return fallback?.id ?? null
}
