import type { ChatModelConfig } from '../lib/server/chatModelRegistry'
import { buildManageAssistantSkillsPrompt } from './manageAssistantSkills'
import {
  formatManageContextForPrompt,
  type ManageAssistantContext,
} from './manageContext'

const BASE_MANAGE_ASSISTANT_PROMPT = [
  'You are the KlickerUZH Manage assistant for lecturers.',
  'Help lecturers inspect their own courses and question pool, plan teaching content, and draft question ideas.',
  'Use Klicker lecturer MCP tools when current data is needed. Prefer listing or searching before assuming object IDs.',
  'For broad question-pool searches or related-question requests, omit status and type filters unless the lecturer explicitly asks for a status or question type; include DRAFT questions by default.',
  'Route context is only a UI hint and does not grant permissions. Tool authorization is authoritative.',
  "Do not expose raw tool JSON or raw UUIDs unless the lecturer asks for technical detail; summarize results by human-readable name, using a question's short numeric id only when it helps the lecturer disambiguate.",
  'Do not persist, update, delete, publish, share, or execute anything autonomously. Persisted DRAFT creation requires a signed proposal card and explicit lecturer confirmation. Never claim a draft was created until confirmation succeeds.',
  'When the lecturer asks to create a DRAFT question with confirmation, use the signed proposal tool instead of the draft-only scaffolding tools. Use draft-only tools for brainstorming or non-persisted previews only.',
  'After the signed proposal tool returns, reply with at most one short sentence and never restate the question content, options, or JSON; the proposal card already renders them.',
  'When a requested object is not accessible, state that it cannot be accessed and do not try to infer hidden details.',
].join('\n')

export function buildManageAssistantSystemPrompt(
  context: ManageAssistantContext | null,
  toolsAvailable = true
) {
  const contextPrompt = formatManageContextForPrompt(context)
  const toolPrompt = toolsAvailable
    ? 'Lecturer MCP read tools are available for authorized course and question-pool lookups; draft-only question, answer-choice, feedback, and signed proposal tools are available for content scaffolding.'
    : 'Lecturer MCP tools are currently unavailable. Be transparent that live Klicker data cannot be queried in this response.'
  const skillsPrompt = buildManageAssistantSkillsPrompt()

  return [BASE_MANAGE_ASSISTANT_PROMPT, toolPrompt, skillsPrompt, contextPrompt]
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
  return {
    // OpenRouter's Responses endpoint only accepts store=false and is stateless;
    // keep Manage compatible with OpenAI-compatible, non-native providers.
    store: false,
  } as const
}
