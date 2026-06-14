// S0 engine spine: a per-request dynamic Mastra agent built from a Klicker
// chatbot row. Instructions come from the DB (systemPrompts[mode]); the model
// is an OpenAI-compatible provider instance (OpenRouter/Azure via env) passed
// directly — no Mastra model-router string required.
import { Agent } from '@mastra/core/agent'
import type { ToolsInput } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../env.js'
import type { ChatbotConfig } from '../db.js'

// Optional engine add-ons layered on by later slices (S1 tools + guardrails).
export type AgentExtras = {
  tools?: ToolsInput
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputProcessors?: any[]
  instructionsSuffix?: string // S3: injected profile context, etc.
}

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
export function buildAgent(
  chatbot: ChatbotConfig,
  mode: string,
  primaryModelId: string,
  extras: AgentExtras = {}
) {
  const provider = providerFor(chatbot)
  // Use the Chat Completions API (`.chat`), NOT the default Responses API.
  // The Responses API references prior response items by call_id across tool-call
  // steps; stateless via OpenRouter/Azure (store:false) the continuation step
  // fails with "No tool call found for function call output". Chat Completions is
  // stateless per request and round-trips tool results correctly. Matches the
  // chat app's documented gotcha (CHAT_OPENAI_STORE_RESPONSES).
  const primary = provider.chat(primaryModelId)
  const fallback = provider.chat(env.FALLBACK_MODEL_ID)
  return new Agent({
    id: `chatbot-${chatbot.id}`,
    name: chatbot.name || 'Course Tutor',
    instructions: resolveInstructions(chatbot, mode) + (extras.instructionsSuffix ?? ''),
    model:
      primaryModelId === env.FALLBACK_MODEL_ID
        ? primary
        : [{ model: primary }, { model: fallback }],
    ...(extras.tools ? { tools: extras.tools } : {}),
    ...(extras.inputProcessors ? { inputProcessors: extras.inputProcessors } : {}),
  })
}
