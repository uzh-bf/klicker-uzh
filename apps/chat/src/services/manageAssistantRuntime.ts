import type { ChatModelConfig } from '@/src/lib/server/chatModelRegistry'
import { getOpenAIResponsesStore } from '@/src/lib/server/openaiResponsesOptions'
import { buildManageAssistantSkillsPrompt } from './manageAssistantSkills'
import {
  formatManageContextForPrompt,
  type ManageAssistantContext,
} from './manageContext'
import {
  describeToolOutputFencingForSystemPrompt,
  type FenceSentinel,
} from './toolOutputFencing'

const BASE_MANAGE_ASSISTANT_PROMPT = [
  'You are the KlickerUZH Manage assistant for lecturers.',
  'Help lecturers inspect their own courses and question pool, plan teaching content, and draft question ideas.',
  'Use Klicker lecturer MCP tools when current data is needed. Prefer listing or searching before assuming object IDs.',
  'For broad question-pool searches or related-question requests, omit status and type filters unless the lecturer explicitly asks for a status or question type; include DRAFT questions by default.',
  'Route context is only a UI hint and does not grant permissions. Tool authorization is authoritative.',
  "Do not expose raw tool JSON or raw UUIDs unless the lecturer asks for technical detail; summarize results by human-readable name, using a question's short numeric id only when it helps the lecturer disambiguate.",
  'Do not persist, update, delete, publish, share, or execute anything autonomously. Persisted DRAFT creation requires a signed proposal card and explicit lecturer confirmation. Never claim a draft was created until confirmation succeeds.',
  'Any lecturer request to create, make, save, store, persist, or add a question is a persistence intent: always use the signed proposal tool (klicker_lecturer_element_create_draft_proposal) to handle it, and never print a proposal or question as JSON in the chat message text. Only an explicit request NOT to save (for example "but do not save it") keeps a drafted question in prose.',
  'Draft-only scaffolding tools are for brainstorming and non-persisted previews only; always present their output as prose, never as JSON, and never as a substitute for the signed proposal tool.',
  'After the signed proposal tool returns, reply with at most one short sentence and never restate the question content, options, or JSON; the proposal card already renders them.',
  'When a requested object is not accessible, state that it cannot be accessed and do not try to infer hidden details.',
].join('\n')

export function buildManageAssistantSystemPrompt(
  context: ManageAssistantContext | null,
  toolsAvailable = true,
  draftToolsAvailable = true,
  toolOutputFenceSentinel?: FenceSentinel
) {
  const contextPrompt = formatManageContextForPrompt(context)
  const toolPrompt = !toolsAvailable
    ? 'Lecturer MCP tools are currently unavailable. Be transparent that live Klicker data cannot be queried in this response.'
    : draftToolsAvailable
      ? 'Lecturer MCP read tools are available for authorized course and question-pool lookups; draft-only question, answer-choice, feedback, and signed proposal tools are available for content scaffolding.'
      : 'Lecturer MCP read tools are available for authorized course and question-pool lookups. This session has read-only Manage access: draft-only question, answer-choice, and feedback scaffolding tools and the signed proposal tool are NOT available. Do not attempt to call them; instead tell the lecturer that drafting and proposing new content requires broader Manage access.'
  // Only meaningful when tools are actually available to call (nothing to
  // fence otherwise) and a sentinel was minted for this request.
  const injectionDefensePrompt =
    toolsAvailable && toolOutputFenceSentinel
      ? describeToolOutputFencingForSystemPrompt(toolOutputFenceSentinel)
      : null
  const skillsPrompt = buildManageAssistantSkillsPrompt()

  return [
    BASE_MANAGE_ASSISTANT_PROMPT,
    toolPrompt,
    injectionDefensePrompt,
    skillsPrompt,
    contextPrompt,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function selectManageAssistantModel(
  registry: ChatModelConfig[]
): ChatModelConfig {
  const primary = registry.find((model) => !model.fallback)
  const fallback = registry[0]
  if (!fallback) {
    throw new Error('Manage assistant requires at least one chat model')
  }
  return primary ?? fallback
}

export function getManageAssistantOpenAIProviderOptions() {
  // Manage shares the sibling chatbot route's OpenAI-compatible backend
  // (same OPENAI_BASE_URL/OPENAI_API_KEY), so it reuses the same
  // env-backed store flag: CHAT_OPENAI_STORE_RESPONSES already encodes
  // whether that backend can persist response items across tool-call
  // steps (stg/prd: true, required for LiteLLM/Azure; local dev default:
  // false, safe for OpenRouter-style stateless backends).
  return {
    store: getOpenAIResponsesStore(),
  } as const
}
