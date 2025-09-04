export type ModelProvider = 'openai' | 'anthropic'

export interface ModelConfiguration {
  id: ModelProvider
  name: string
  description: string
}

export const MODEL_CONFIGS: Record<ModelProvider, ModelConfiguration> = {
  openai: {
    id: 'openai',
    name: 'GPT-4.1',
    description: 'OpenAI model',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Claude 4 Sonnet',
    description: 'Anthropic model',
  },
}

export function getModelOptions() {
  return Object.values(MODEL_CONFIGS).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }))
}
