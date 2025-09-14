export const MODEL_IDS = ['gpt-4.1', 'gpt-4.1-mini'] as const
export type ModelID = (typeof MODEL_IDS)[number]

export interface ModelConfiguration {
  id: ModelID
  link: string
  name: string
  description: string
  cost: {
    input: number // cost per 1M tokens in USD
    output: number // cost per 1M tokens in USD
  }
  fallback: boolean // whether this is allowed when credits are 0
}

export const MODEL_CONFIGS: ModelConfiguration[] = [
  {
    id: 'gpt-4.1',
    link: 'https://klicker-ai.openai.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2025-01-01-preview',
    name: 'GPT-4.1',
    description: 'OpenAI model',
    cost: {
      input: 2.0,
      output: 8.0,
    },
    fallback: false,
  },
  {
    id: 'gpt-4.1-mini',
    link: 'https://klicker-ai.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview',
    name: 'GPT-4.1 Mini',
    description: 'Small OpenAI model',
    cost: {
      input: 0.4,
      output: 1.6,
    },
    fallback: true,
  },
]

export function getModelOptions() {
  return MODEL_CONFIGS.map(({ id, name, description, fallback }) => ({
    id,
    name,
    description,
    fallback,
  }))
}

export function getModelById(modelId: string) {
  const model = MODEL_CONFIGS.find((m) => m.id === modelId)
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`)
  }
  return model
}

export function getModelCost(modelId: string) {
  const model = getModelById(modelId)
  return model.cost
}

export function getModelLink(modelId: string) {
  const model = getModelById(modelId)
  return model.link
}
