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
