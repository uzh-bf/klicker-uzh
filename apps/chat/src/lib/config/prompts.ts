import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

// The Tutor contract is versioned so a deployment or evaluation can fall back to
// the earlier v1 rules with CHAT_TUTOR_PROMPT_VERSION=v1; any other value uses v2.
const TUTOR_TEMPLATE =
  process.env.CHAT_TUTOR_PROMPT_VERSION === 'v1'
    ? 'mode-tutor'
    : 'mode-tutor-v2'

export const DEFAULT_PROMPT: Record<string, { prompt: string }> = {
  tutor: { prompt: renderPromptTemplate(TUTOR_TEMPLATE, {}) },
  explainer: { prompt: renderPromptTemplate('mode-explainer', {}) },
  quizzer: {
    prompt: renderPromptTemplate('mode-quizzer', {
      courseRetrievalAvailable: false,
      isElearningOrigin: false,
    }),
  },
  'writing-coach': { prompt: renderPromptTemplate('mode-writing-coach', {}) },
}
