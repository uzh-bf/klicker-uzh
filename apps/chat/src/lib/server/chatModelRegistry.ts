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

export function getChatModelRegistry(): ChatModelConfig[] {
  if (cachedRegistry) return cachedRegistry

  const raw = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!raw) {
    cachedRegistry = DEFAULT_MODEL_REGISTRY
    return cachedRegistry
  }

  try {
    cachedRegistry = chatModelRegistrySchema.parse(JSON.parse(raw))
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

export function getAutomaticModelId(credits: { current: number }): string {
  const registry = getChatModelRegistry()

  const configuredPrimary = process.env.CHAT_PRIMARY_MODEL_ID
  const configuredFallback = process.env.CHAT_FALLBACK_MODEL_ID

  const primary =
    (configuredPrimary && registry.find((m) => m.id === configuredPrimary)) ||
    registry.find((m) => m.fallback === false) ||
    registry[0]

  const fallback =
    (configuredFallback && registry.find((m) => m.id === configuredFallback)) ||
    registry.find((m) => m.fallback === true) ||
    primary

  return credits.current > 0 ? primary.id : fallback.id
}
