export type ModelID = 'gpt-4.1' | 'claude-sonnet-4-0'

export interface ModelConfiguration {
  id: ModelID
  name: string
  description: string
  cost: {
    input: number // cost per 1M tokens in USD
    output: number // cost per 1M tokens in USD
  }
}

export const MODEL_CONFIGS: ModelConfiguration[] = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'OpenAI model',
    cost: {
      input: 0.25,
      output: 2.0,
    },
  },
  {
    id: 'claude-sonnet-4-0',
    name: 'Claude 4 Sonnet',
    description: 'Anthropic model',
    cost: {
      input: 3.0,
      output: 15.0,
    },
  },
]

export function getModelOptions() {
  return MODEL_CONFIGS.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }))
}

export function getModelCost(modelId: string) {
  const model = MODEL_CONFIGS.find((m) => m.id === modelId)
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`)
  }
  return model.cost
}
