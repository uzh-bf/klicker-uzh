import { z } from 'zod'

const chatModelSchema = z.object({
  id: z.string().min(1),
  deploymentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  fallback: z.boolean().default(false),
  apiVersion: z.string().min(1),
  cost: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
  }),
})

const chatModelRegistrySchema = z.array(chatModelSchema).min(1)

export type ChatModelConfig = z.infer<typeof chatModelSchema>
export type PublicChatModel = Pick<
  ChatModelConfig,
  'id' | 'name' | 'description' | 'fallback'
>

const DEFAULT_MODEL_REGISTRY: ChatModelConfig[] = [
  {
    id: 'gpt-4.1',
    deploymentId: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'OpenAI model',
    fallback: false,
    apiVersion: '2025-01-01-preview',
    cost: { input: 2.0, output: 8.0 },
  },
  {
    id: 'gpt-5.1',
    deploymentId: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'OpenAI reasoning model',
    fallback: false,
    apiVersion: '2025-04-01-preview',
    cost: { input: 1.25, output: 10.0 },
  },
  {
    id: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Small OpenAI model',
    fallback: true,
    apiVersion: '2025-01-01-preview',
    cost: { input: 0.4, output: 1.6 },
  },
]

let cachedRegistry: ChatModelConfig[] | null = null
let warnedMissingRegistry = false
let warnedInvalidAutoModels = false

function validateUniqueIds(models: ChatModelConfig[]) {
  const ids = new Set<string>()
  for (const model of models) {
    if (ids.has(model.id)) {
      throw new Error(`Duplicate model id in registry: ${model.id}`)
    }
    ids.add(model.id)
  }
}

function getRegistryFromEnv(): ChatModelConfig[] {
  if (cachedRegistry) return cachedRegistry

  const raw = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!raw) {
    if (!warnedMissingRegistry) {
      warnedMissingRegistry = true
      console.warn(
        '[chat] CHAT_MODEL_REGISTRY_JSON is not set; falling back to built-in defaults.'
      )
    }
    cachedRegistry = DEFAULT_MODEL_REGISTRY
    return cachedRegistry
  }

  const parsedJson = JSON.parse(raw)
  const models = chatModelRegistrySchema.parse(parsedJson)
  validateUniqueIds(models)

  cachedRegistry = models
  return cachedRegistry
}

export function getChatModelRegistry(): ChatModelConfig[] {
  return getRegistryFromEnv()
}

export function getChatModel(modelId: string): ChatModelConfig | undefined {
  return getRegistryFromEnv().find((m) => m.id === modelId)
}

export function getPublicChatModels(): PublicChatModel[] {
  return getRegistryFromEnv().map(({ id, name, description, fallback }) => ({
    id,
    name,
    description,
    fallback,
  }))
}

export function getAutomaticModelId(credits: { current: number }): string {
  const registry = getRegistryFromEnv()

  const configuredPrimary = process.env.CHAT_PRIMARY_MODEL_ID
  const configuredFallback = process.env.CHAT_FALLBACK_MODEL_ID

  const primaryId = configuredPrimary ?? 'gpt-4.1'
  const fallbackId = configuredFallback ?? 'gpt-4.1-mini'

  const primaryExists = registry.some((m) => m.id === primaryId)
  const fallbackExists = registry.some((m) => m.id === fallbackId)

  if ((!primaryExists || !fallbackExists) && !warnedInvalidAutoModels) {
    warnedInvalidAutoModels = true
    console.warn(
      `[chat] CHAT_PRIMARY_MODEL_ID/CHAT_FALLBACK_MODEL_ID do not match registry (primary=${primaryId} exists=${primaryExists}, fallback=${fallbackId} exists=${fallbackExists}). Falling back to registry-derived defaults.`
    )
  }

  const derivedPrimary =
    registry.find((m) => m.id === primaryId) ??
    registry.find((m) => m.fallback === false) ??
    registry[0]

  const derivedFallback =
    registry.find((m) => m.id === fallbackId) ??
    registry.find((m) => m.fallback === true) ??
    derivedPrimary

  return credits.current > 0 ? derivedPrimary.id : derivedFallback.id
}
