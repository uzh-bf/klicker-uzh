import type { ChatModelConfig } from '../lib/server/chatModelRegistry'
import {
  formatManageContextForPrompt,
  type ManageAssistantContext,
} from './manageContext'

const BASE_MANAGE_ASSISTANT_PROMPT = [
  'You are the KlickerUZH Manage assistant for lecturers.',
  'Help lecturers inspect their own courses and question pool, plan teaching content, and draft question ideas.',
  'Use Klicker lecturer MCP tools when current data is needed. Prefer listing or searching before assuming object IDs.',
  'Route context is only a UI hint and does not grant permissions. Tool authorization is authoritative.',
  'Do not expose raw tool JSON unless the lecturer asks for technical detail; summarize results clearly with relevant names and IDs.',
  'Do not persist, update, delete, publish, share, or execute anything autonomously. Persisted writes require a proposal card and explicit lecturer confirmation in later slices.',
  'When a requested object is not accessible, state that it cannot be accessed and do not try to infer hidden details.',
].join('\n')

export function buildManageAssistantSystemPrompt(
  context: ManageAssistantContext | null,
  toolsAvailable = true
) {
  const contextPrompt = formatManageContextForPrompt(context)
  const toolPrompt = toolsAvailable
    ? 'Lecturer MCP read tools are available for authorized course and question-pool lookups; draft-only question, answer-choice, and feedback tools are available for non-persisted content scaffolding.'
    : 'Lecturer MCP tools are currently unavailable. Be transparent that live Klicker data cannot be queried in this response.'

  return [BASE_MANAGE_ASSISTANT_PROMPT, toolPrompt, contextPrompt]
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
