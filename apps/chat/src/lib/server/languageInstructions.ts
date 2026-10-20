import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

/**
 * Appended to every chatbot system prompt so the response language follows
 * the user rather than the language of the persona or retrieved material.
 * This cannot live only in `DEFAULT_PROMPT`: standard-mode lecturer guidance
 * and custom personas are separate prompt layers, and neither owns platform
 * language policy.
 */
const LANGUAGE_STYLE_CONTRACT = renderPromptTemplate('language-style', {})

/**
 * Appends the conversation-language and Swiss Standard German contract to
 * `systemPrompt`. It is unconditional because it must survive every stored
 * lecturer prompt and does not depend on which tools are available.
 */
export function withLanguageStyleContract(systemPrompt: string): string {
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${LANGUAGE_STYLE_CONTRACT}`
    : LANGUAGE_STYLE_CONTRACT
}

/**
 * Restates the reply-language rule as the last message of every model step.
 * The rule in the system prompt alone loses to long other-language material,
 * such as retrieved passages, that the model reads just before answering.
 * The model identifies the language itself, so the reminder works for any
 * language the user writes in.
 */
export const REPLY_LANGUAGE_REMINDER = {
  role: 'system',
  content: renderPromptTemplate('reply-language-reminder', {}),
} as const
