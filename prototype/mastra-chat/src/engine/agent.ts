// S0 engine spine: a per-request dynamic Mastra agent built from a Klicker
// chatbot row. Instructions come from the DB (systemPrompts[mode]); the model
// is an OpenAI-compatible provider instance (OpenRouter/Azure via env) passed
// directly — no Mastra model-router string required.
import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../env.js'
import type { ChatbotConfig } from '../db.js'

// One provider per (baseURL, apiKey). Per-chatbot key/url override is supported
// by building a provider from the chatbot row when present.
const defaultProvider = createOpenAI({
  baseURL: env.OPENAI_BASE_URL,
  apiKey: env.OPENAI_API_KEY,
})

function providerFor(chatbot: ChatbotConfig) {
  if (chatbot.openaiApiKey && chatbot.openaiBaseUrl) {
    return createOpenAI({ baseURL: chatbot.openaiBaseUrl, apiKey: chatbot.openaiApiKey })
  }
  return defaultProvider
}

const DEFAULT_INSTRUCTIONS =
  'You are a helpful university course tutor. Answer concisely and accurately. ' +
  'If you are unsure, say so.'

export function resolveInstructions(chatbot: ChatbotConfig, mode: string): string {
  return chatbot.systemPrompts?.[mode]?.prompt || DEFAULT_INSTRUCTIONS
}

// Build a model list for fallback: [primary, fallback]. Mastra retries the next
// entry (ModelWithRetries) on provider errors (5xx/429/timeout). A deliberately
// wrong primary id exercises the fallback path in S0. Single-entry when the
// requested model already is the fallback (avoids a redundant retry tier).
export function buildAgent(chatbot: ChatbotConfig, mode: string, primaryModelId: string) {
  const provider = providerFor(chatbot)
  const primary = provider(primaryModelId)
  const fallback = provider(env.FALLBACK_MODEL_ID)
  return new Agent({
    id: `chatbot-${chatbot.id}`,
    name: chatbot.name || 'Course Tutor',
    instructions: resolveInstructions(chatbot, mode),
    model:
      primaryModelId === env.FALLBACK_MODEL_ID
        ? primary
        : [{ model: primary }, { model: fallback }],
  })
}
