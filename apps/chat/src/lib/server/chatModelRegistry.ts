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
    supportsImageAttachments: z.boolean().default(false),
    supportedReasoningEfforts: z.array(z.string().min(1)).optional(),
    maxOutputTokens: z.number().positive().optional(),
    apiVersion: z.string().min(1).optional(),
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
    }

    if (!hasFallback) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'At least one model with "fallback: true" is required for credit-safe automatic selection.',
      })
    }
  })

type RawChatModelConfig = z.infer<typeof chatModelSchema>
export type ReasoningEffortByModel = Record<string, ReasoningEffort[]>
export type ChatModelConfig = Omit<
  RawChatModelConfig,
  'supportedReasoningEfforts'
> & {
  supportedReasoningEfforts: ReasoningEffort[]
}

function dedupeStrings(values: readonly string[]) {
  return Array.from(new Set(values))
}

function normalizeChatModelConfig(model: RawChatModelConfig): ChatModelConfig {
  if (!model.supportsReasoning) {
    return {
      ...model,
      supportedReasoningEfforts: [],
    }
  }

  return {
    ...model,
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

export const DEFAULT_MODEL_REGISTRY: ChatModelConfig[] = [
  {
    id: 'auto',
    deploymentId: 'auto-router',
    name: 'Auto Mode',
    description: 'Automatic model selection through the LiteLLM auto router',
    fallback: false,
    supportsReasoning: false,
    supportsImageAttachments: true,
    supportedReasoningEfforts: [],
    cost: { input: 1.25, output: 10.0 },
  },
  {
    id: 'gpt-5.6-luna',
    deploymentId: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'OpenAI reasoning model',
    fallback: false,
    supportsReasoning: true,
    supportsImageAttachments: true,
    supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    cost: { input: 1.25, output: 10.0 },
  },
  {
    id: 'gpt-4.1',
    deploymentId: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'OpenAI model',
    fallback: false,
    supportsReasoning: false,
    supportsImageAttachments: true,
    supportedReasoningEfforts: [],
    cost: { input: 2.0, output: 8.0 },
  },
  {
    id: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Small OpenAI model',
    fallback: true,
    supportsReasoning: false,
    supportsImageAttachments: true,
    supportedReasoningEfforts: [],
    cost: { input: 0.4, output: 1.6 },
  },
]

let cachedRegistry: ChatModelConfig[] | null = null

export function getChatModelRegistry(): ChatModelConfig[] {
  if (cachedRegistry) return cachedRegistry

  const raw = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!raw) {
    cachedRegistry = DEFAULT_MODEL_REGISTRY
    return cachedRegistry
  }

  try {
    cachedRegistry = parseRegistryValue(JSON.parse(raw))
    return cachedRegistry
  } catch (error) {
    console.warn(
      '[chat] Invalid CHAT_MODEL_REGISTRY_JSON; falling back to built-in defaults.',
      error
    )
    cachedRegistry = DEFAULT_MODEL_REGISTRY
    return cachedRegistry
  }
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

/**
 * Filters the global model registry by a chatbot's allow-list and credit availability.
 * Empty allowedModelIds means all models are available (backward-compatible default).
 */
export function getModelsForChatbot(
  chatbot: {
    allowedModelIds: string[]
    allowedReasoningEffortsByModel?: unknown
  },
  credits: { current: number }
): ChatModelConfig[] {
  let models = getChatModelRegistry()
  if (chatbot.allowedModelIds.length > 0) {
    const allowed = new Set(chatbot.allowedModelIds)
    models = models.filter((m) => allowed.has(m.id) || m.fallback)
  }
  if (credits.current <= 0) {
    models = models.filter((m) => m.fallback)
  }
  return models.map((model) => ({
    ...model,
    supportedReasoningEfforts: getAllowedReasoningEffortsForModel(
      model,
      chatbot.allowedReasoningEffortsByModel
    ),
  }))
}

export function getAutomaticModelId(
  credits: { current: number },
  allowedModelIds?: string[]
): string {
  let registry = getChatModelRegistry()

  if (allowedModelIds && allowedModelIds.length > 0) {
    const allowed = new Set(allowedModelIds)
    const filtered = registry.filter((m) => allowed.has(m.id) || m.fallback)
    if (filtered.length > 0) {
      registry = filtered
    }
  }

  const configuredPrimary = process.env.CHAT_PRIMARY_MODEL_ID
  const configuredFallback = process.env.CHAT_FALLBACK_MODEL_ID

  const defaultPrimary = registry.find((model) => model.fallback === false)
  const defaultFallback = registry.find((model) => model.fallback === true)

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

  const fallbackCandidate = configuredFallback
    ? registry.find((model) => model.id === configuredFallback)
    : undefined

  const fallback =
    (fallbackCandidate?.fallback ? fallbackCandidate : null) ||
    defaultFallback ||
    primary

  if (configuredFallback && fallback.id !== configuredFallback) {
    if (fallbackCandidate) {
      console.warn(
        `[chat] CHAT_FALLBACK_MODEL_ID="${configuredFallback}" is not marked as fallback; using "${fallback.id}".`
      )
    } else {
      console.warn(
        `[chat] CHAT_FALLBACK_MODEL_ID="${configuredFallback}" is not in the registry; using "${fallback.id}".`
      )
    }
  }

  return credits.current > 0 ? primary.id : fallback.id
}
