import { z } from 'zod'

// This tracer keeps a local copy until Slice 3 moves the policy module behind
// the shared chat-api boundary; the old Next route must keep importing its own
// module while both paths are exercised.

export type ReasoningEffort = string

const modelSchema = z
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

const registrySchema = z
  .array(modelSchema)
  .min(1)
  .superRefine((models, ctx) => {
    const ids = new Set<string>()
    let hasFallback = false
    for (const [index, model] of models.entries()) {
      if (ids.has(model.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: `Duplicate model id "${model.id}"`,
        })
      }
      ids.add(model.id)
      hasFallback ||= model.fallback
    }
    if (!hasFallback) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'At least one model with "fallback: true" is required for credit-safe automatic selection.',
      })
    }
  })

export type ChatModelConfig = Omit<
  z.infer<typeof modelSchema>,
  'supportedReasoningEfforts'
> & { supportedReasoningEfforts: ReasoningEffort[] }

const dedupe = (values: readonly string[]) => Array.from(new Set(values))

function normalize(model: z.infer<typeof modelSchema>): ChatModelConfig {
  return {
    ...model,
    supportedReasoningEfforts: model.supportsReasoning
      ? dedupe(model.supportedReasoningEfforts ?? [])
      : [],
  }
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
    cost: { input: 1.25, output: 10 },
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
    cost: { input: 1.25, output: 10 },
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
    cost: { input: 2, output: 8 },
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
    cachedRegistry = registrySchema.parse(JSON.parse(raw)).map(normalize)
  } catch (error) {
    console.warn(
      '[chat-api] Invalid CHAT_MODEL_REGISTRY_JSON; using built-in defaults.',
      error
    )
    cachedRegistry = DEFAULT_MODEL_REGISTRY
  }
  return cachedRegistry
}

export function getAllowedReasoningEffortsForModel(
  model: Pick<
    ChatModelConfig,
    'id' | 'supportsReasoning' | 'supportedReasoningEfforts'
  >,
  rawConfig: unknown
): ReasoningEffort[] {
  if (!model.supportsReasoning) return []
  const supported = dedupe(model.supportedReasoningEfforts)
  if (supported.length === 0) return []
  const configured =
    rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
      ? (rawConfig as Record<string, unknown>)[model.id]
      : undefined
  if (!Array.isArray(configured)) return supported
  const allowed = new Set(
    configured.filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    )
  )
  const intersection = supported.filter((value) => allowed.has(value))
  return intersection.length > 0 ? intersection : supported
}

export function getAutomaticModelId(
  credits: { current: number },
  allowedModelIds?: string[]
): string {
  let registry = getChatModelRegistry()
  if (allowedModelIds && allowedModelIds.length > 0) {
    const allowed = new Set(allowedModelIds)
    const filtered = registry.filter(
      (model) => allowed.has(model.id) || model.fallback
    )
    if (filtered.length > 0) registry = filtered
  }

  const configuredPrimary = process.env.CHAT_PRIMARY_MODEL_ID
  const configuredFallback = process.env.CHAT_FALLBACK_MODEL_ID
  const primary =
    (configuredPrimary &&
      registry.find((model) => model.id === configuredPrimary)) ||
    registry.find((model) => !model.fallback) ||
    registry[0]!
  const fallback =
    (configuredFallback &&
      registry.find(
        (model) => model.id === configuredFallback && model.fallback
      )) ||
    registry.find((model) => model.fallback) ||
    primary
  return credits.current > 0 ? primary.id : fallback.id
}

export function calculateCost(
  cost: Pick<ChatModelConfig, 'cost'>['cost'],
  inputTokens: number,
  outputTokens: number
): number {
  return (
    (cost.input * Math.max(0, inputTokens) +
      cost.output * Math.max(0, outputTokens)) /
    1_000_000
  )
}
