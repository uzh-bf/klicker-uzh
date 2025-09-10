import { MODE_PROMPTS, type ChatbotMode } from './prompts'

export interface ModeConfiguration {
  id: ChatbotMode
  name: string
  description: string
  prompt: string
}

export const CHAT_MODE_CONFIGS: Record<ChatbotMode, ModeConfiguration> = {
  tutor: {
    id: 'tutor',
    name: 'Tutor',
    description: 'Step-by-step learning guidance',
    prompt: MODE_PROMPTS.tutor,
  },
  explainer: {
    id: 'explainer',
    name: 'Explainer',
    description: 'Clear and comprehensive explanations',
    prompt: MODE_PROMPTS.explainer,
  },
}

export function getModeOptions() {
  return Object.values(CHAT_MODE_CONFIGS).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }))
}
