import { DEFAULT_PROMPT } from '@/src/lib/config/prompts'
import { withCitationContract } from '@/src/lib/server/citationInstructions'
import { withLanguageStyleContract } from '@/src/lib/server/languageInstructions'

/**
 * Resolve the base system prompt for one chat turn from the chatbot's stored
 * per-mode prompts, falling back to the built-in `DEFAULT_PROMPT`.
 *
 * Behaviour deliberately preserved from the original inline resolution (do not
 * "tidy" without a behaviour review — the chat route relies on each quirk):
 * - A stored mode entry whose `prompt` is empty/absent falls through to the
 *   default for that mode, then to `''`. An empty stored prompt is never sent.
 * - An unknown mode (no stored entry and no `DEFAULT_PROMPT` entry, e.g.
 *   `explainer` while the default only defines `tutor`) yields `''`.
 */
function resolveBaseSystemPrompt(
  systemPrompts: unknown,
  selectedMode: string
): string {
  const stored = systemPrompts as
    | Record<string, Record<string, string> | undefined>
    | null
    | undefined
  if (stored?.[selectedMode]) {
    return (
      stored[selectedMode].prompt || DEFAULT_PROMPT[selectedMode]?.prompt || ''
    )
  }
  return DEFAULT_PROMPT[selectedMode]?.prompt || ''
}

/**
 * Compile the full system prompt actually sent to the model: the resolved base
 * prompt with the layered runtime contracts applied in fixed order — citation
 * (inner) then language style (outer), so the final text reads base, then
 * citation, then language.
 *
 * The citation contract is appended only when a doc_query-style RAG tool is
 * available for the request (decided inside `withCitationContract` from
 * `toolNames`). The language-style contract is unconditional, because a stored
 * lecturer prompt replaces `DEFAULT_PROMPT` entirely and Swiss High German
 * orthography must still be enforced for every chatbot.
 */
export function compileSystemPrompt(
  systemPrompts: unknown,
  selectedMode: string,
  toolNames: readonly string[]
): string {
  const base = resolveBaseSystemPrompt(systemPrompts, selectedMode)
  return withLanguageStyleContract(withCitationContract(base, toolNames))
}
