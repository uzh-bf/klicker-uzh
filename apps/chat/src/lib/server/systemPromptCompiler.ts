import { DEFAULT_PROMPT } from '@/src/lib/config/prompts'
import { withCitationContract } from '@/src/lib/server/citationInstructions'
import { withCoursePolicyContract } from '@/src/lib/server/coursePolicyInstructions'
import { withInputContextContract } from '@/src/lib/server/inputContextInstructions'
import { withLanguageStyleContract } from '@/src/lib/server/languageInstructions'

/**
 * Resolve the base system prompt for one chat turn from the chatbot's stored
 * per-mode prompts, falling back to the built-in `DEFAULT_PROMPT`.
 *
 * Behaviour deliberately preserved from the original inline resolution (do not
 * "tidy" without a behaviour review — the chat route relies on each quirk):
 * - A stored mode entry whose `prompt` is empty/absent falls through to the
 *   default for that mode, then to `''`. An empty stored prompt is never sent.
 * - An unknown mode with no stored entry and no `DEFAULT_PROMPT` entry yields
 *   `''`.
 */
function resolveBaseSystemPrompt(
  systemPrompts: unknown,
  selectedMode: string
): string {
  if (
    systemPrompts !== null &&
    typeof systemPrompts === 'object' &&
    !Array.isArray(systemPrompts)
  ) {
    const storedMode = (systemPrompts as Record<string, unknown>)[selectedMode]
    if (
      storedMode !== null &&
      typeof storedMode === 'object' &&
      !Array.isArray(storedMode)
    ) {
      const prompt = (storedMode as Record<string, unknown>).prompt
      if (typeof prompt === 'string' && prompt.length > 0) {
        return prompt
      }
    }
  }
  return DEFAULT_PROMPT[selectedMode]?.prompt || ''
}

/**
 * Compile the full system prompt actually sent to the model: the resolved base
 * prompt with runtime data and fixed contracts applied in this order: base
 * persona, bounded runtime context, attachment context, course policy,
 * conditional citations, then language. Placing the fixed contracts after
 * runtime data prevents untrusted page or practice-candidate fields from
 * becoming the final system-level instruction.
 *
 * The citation contract is appended only when a doc_query-style RAG tool is
 * available for the request (decided inside `withCitationContract` from
 * `toolNames`). The course and language contracts are unconditional because a
 * stored lecturer prompt replaces `DEFAULT_PROMPT` entirely and must not be
 * able to remove platform scope, privacy, safety, or language policy.
 */
export function compileSystemPrompt(
  systemPrompts: unknown,
  selectedMode: string,
  toolNames: readonly string[],
  runtimeContextBlocks: readonly string[] = []
): string {
  const base = resolveBaseSystemPrompt(systemPrompts, selectedMode)
  const runtimeContext = runtimeContextBlocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join('\n\n')
  const contextualBase = runtimeContext
    ? base.trimEnd().length > 0
      ? `${base.trimEnd()}\n\n${runtimeContext}`
      : runtimeContext
    : base
  const inputContext = withInputContextContract(contextualBase)
  const coursePolicy = withCoursePolicyContract(inputContext, toolNames)
  const citations = withCitationContract(coursePolicy, toolNames)
  return withLanguageStyleContract(citations)
}
