// S1 — input guardrail processors.
// Four guardrails requested by the plan, mapped to Mastra-native processors:
//   prompt-injection -> PromptInjectionDetector  (LLM-backed)
//   moderation       -> ModerationProcessor      (LLM-backed)
//   PII              -> PIIDetector              (LLM-backed)
//   token-limit      -> TokenLimiterProcessor    (deterministic)
// The three LLM-backed detectors each cost an extra classifier call per request
// — a real latency/cost finding recorded in RESULTS. `strategy: 'block'` makes a
// trip observable: the run aborts with a tripwire instead of reaching the model.
import {
  PromptInjectionDetector,
  ModerationProcessor,
  PIIDetector,
  TokenLimiterProcessor,
} from '@mastra/core/processors'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../env.js'

const guardrailProvider = createOpenAI({
  baseURL: env.OPENAI_BASE_URL,
  apiKey: env.OPENAI_API_KEY,
})
// Chat Completions API (see agent.ts note on the Responses-API tool-call gotcha).
const classifier = guardrailProvider.chat(env.GUARDRAIL_MODEL_ID)

export type GuardrailConfig = {
  promptInjection?: boolean
  moderation?: boolean
  pii?: boolean
  tokenLimit?: number // 0/undefined = off
}

// Per-mode guardrail policy. In production this comes from chatbot/mode config;
// the prototype hard-codes a sane default and lets a request override it.
export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  promptInjection: true,
  moderation: true,
  pii: true,
  tokenLimit: 0,
}

// Build the ordered inputProcessors array for an agent from a guardrail config.
// Order: cheap/deterministic token cap first, then the LLM detectors.
export function buildInputProcessors(cfg: GuardrailConfig) {
  const processors = []
  if (cfg.tokenLimit && cfg.tokenLimit > 0) {
    processors.push(new TokenLimiterProcessor({ limit: cfg.tokenLimit, strategy: 'abort' }))
  }
  if (cfg.promptInjection) {
    processors.push(
      new PromptInjectionDetector({ model: classifier, strategy: 'block', threshold: 0.6 })
    )
  }
  if (cfg.moderation) {
    processors.push(new ModerationProcessor({ model: classifier, strategy: 'block', threshold: 0.5 }))
  }
  if (cfg.pii) {
    processors.push(new PIIDetector({ model: classifier, strategy: 'block', threshold: 0.6 }))
  }
  return processors
}
