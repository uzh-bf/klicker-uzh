// S0 engine spine: a per-request dynamic Mastra agent built from a Klicker
// chatbot row. Instructions come from the DB (systemPrompts[mode]); the model
// is an OpenAI-compatible provider instance (OpenRouter/Azure via env) passed
// directly — no Mastra model-router string required.
import { Agent } from '@mastra/core/agent'
import type { ToolsInput } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
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

// Reasoning models use the OpenRouter AI SDK provider instead of @ai-sdk/openai.
// A2 validated that @ai-sdk/openai's Chat Completions parser DROPS OpenRouter's
// `reasoning` delta field — the reasoning bytes arrive over the wire but never
// become AI-SDK reasoning parts. The OpenRouter provider surfaces them as
// reasoning-start / reasoning-delta / reasoning-end. Non-reasoning models stay on
// @ai-sdk/openai .chat(), which round-trips tool results correctly under
// store:false (the S0 reason for choosing Chat Completions over the Responses API).
// Reasoning effort is requested per call via providerOptions.openrouter.reasoning.
//
// LIMITATION (prototype): reasoning models always use the default OpenRouter creds
// (env), NOT a chatbot row's openaiApiKey/openaiBaseUrl override. A per-chatbot
// override may point at a non-OpenRouter endpoint (e.g. Azure), which this provider
// cannot drive — production would resolve the capability×provider matrix properly.
const reasoningProvider = createOpenRouter({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
})

// Provider-prefixed reasoning-model ids: the o-series (o1/o3/o4/…, anchored to id
// start or after the provider slash so `gpt-4o` is NOT matched), gpt-5 *thinking*
// variants, deepseek-r1, and the `:thinking` suffix (un-anchored — it marks a
// thinking variant of an otherwise non-reasoning id, e.g. claude-…:thinking).
const REASONING_MODEL_RE = /(^|\/)(o\d|gpt-5[.\-].*think|deepseek-r1)|:thinking/i

export function isReasoningModel(modelId: string): boolean {
  return REASONING_MODEL_RE.test(modelId)
}

// Build a language model for an id, routing reasoning models to the OpenRouter
// provider and everything else to the (override-aware) @ai-sdk/openai provider.
function modelFor(chatbot: ChatbotConfig, modelId: string) {
  // Use the Chat Completions API (`.chat`), NOT the default Responses API.
  // The Responses API references prior response items by call_id across tool-call
  // steps; stateless via OpenRouter/Azure (store:false) the continuation step
  // fails with "No tool call found for function call output". Chat Completions is
  // stateless per request and round-trips tool results correctly. Matches the
  // chat app's documented gotcha (CHAT_OPENAI_STORE_RESPONSES).
  return isReasoningModel(modelId)
    ? reasoningProvider.chat(modelId)
    : providerFor(chatbot).chat(modelId)
}

// The agent.stream `providerOptions` that turn reasoning on for a model — owned
// here because this module also owns which provider a model id routes to, and the
// reasoning toggle is provider-specific (the OpenRouter provider keys it under
// `openrouter`). Returns undefined when the model is not reasoning-capable or no
// effort (or 'none') is requested, so the HTTP layer passes it straight to
// agent.stream without hard-coding any provider key or re-deciding capability.
export function reasoningProviderOptions(modelId: string, effort: string | undefined) {
  if (!effort || effort === 'none' || !isReasoningModel(modelId)) return undefined
  return { openrouter: { reasoning: { effort } } }
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
  const primary = modelFor(chatbot, primaryModelId)
  const fallback = modelFor(chatbot, env.FALLBACK_MODEL_ID)
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
