import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

export const DEFAULT_PROMPT: Record<string, { prompt: string }> = {
  tutor: { prompt: renderPromptTemplate('mode-tutor', {}) },
  explainer: { prompt: renderPromptTemplate('mode-explainer', {}) },
  quizzer: { prompt: renderPromptTemplate('mode-quizzer', {}) },
}
