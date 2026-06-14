// S0 engine spine: a per-request dynamic Mastra agent built from a Klicker
// chatbot row. Instructions come from the DB (systemPrompts[mode]); the model
// is a standard OpenAI provider instance (@ai-sdk/openai) pointed at an
// OpenAI-compatible endpoint via env — Azure AI Foundry in prod (through the same
// /openai/v1 surface the chat app uses via LiteLLM), no Mastra model-router
// string required.
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

// Reasoning-capable model ids: the o-series (o1/o3/o4/…, anchored to id start or
// after the provider slash so `gpt-4o` is NOT matched), the entire gpt-5 family
// (gpt-5, gpt-5-mini, gpt-5.1, … — all reasoning models; the `(?!\d)` keeps a
// hypothetical `gpt-50` from matching), deepseek-r1, and the `:thinking` suffix
// (un-anchored — it marks a thinking variant of an otherwise non-reasoning id,
// e.g. claude-…:thinking).
const REASONING_MODEL_RE = /(^|\/)(o\d|gpt-5(?!\d)|deepseek-r1)|:thinking/i

function isReasoningModel(modelId: string): boolean {
  return REASONING_MODEL_RE.test(modelId)
}

// Build the Responses-API `providerOptions` for a request AND report whether
// reasoning is engaged — decided once here (single source of truth) and consumed
// by the HTTP layer for both agent.stream (`options`) and the finish metadata
// (`reasoningOn`). store:true is always set (tool-call round-tripping, matches the
// chat app); reasoningEffort + reasoningSummary are added only when reasoning is
// engaged — non-reasoning models like gpt-4.1-mini ignore them, but we omit them to
// avoid provider 400s on strict backends. Keyed under `openai` (the provider
// namespace), so the HTTP layer passes `options` straight to agent.stream.
//
// reasoningSummary is 'detailed' (the chat app uses 'auto'): Azure's reasoning
// summaries are bursty — a response streams either a full summary or none, and the
// non-empty rate swings window to window (a provider quirk, not a pipeline drop;
// see check-reasoning.ts). 'detailed' biases toward richer summaries when one is
// emitted, but does NOT guarantee non-empty on any single call; a UI must tolerate
// reasoning tokens arriving with no human-readable summary.
export function responsesProviderOptions(modelId: string, effort: string | undefined) {
  // Reasoning is engaged only for a reasoning-capable model AND a non-empty effort
  // other than 'none' (effort 'none' disables reasoning even on a gpt-5/o-series
  // model, matching the chat app).
  const reasoningOn = !!effort && effort !== 'none' && isReasoningModel(modelId)
  return {
    reasoningOn,
    options: {
      openai: {
        store: true,
        ...(reasoningOn ? { reasoningEffort: effort, reasoningSummary: 'detailed' } : {}),
      },
    },
  }
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
  // Use the Responses API (`.responses`), matching the chat app. With store:true
  // (set in responsesProviderOptions) the server retains response items, so tool-call
  // continuation steps can reference prior items by id — the S0 "No tool call found
  // for function call output" failure was store:false, not the Responses API itself
  // (see the chat app's CHAT_OPENAI_STORE_RESPONSES gotcha). It is also the ONLY
  // standard-OpenAI path that surfaces reasoning summaries; Chat Completions hides
  // reasoning as opaque reasoning_tokens. Works identically against Azure's /openai/v1.
  const primary = provider.responses(primaryModelId)
  const fallback = provider.responses(env.FALLBACK_MODEL_ID)
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
