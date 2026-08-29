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
 * Resolve the configurable persona and bounded runtime data that must precede
 * every fixed platform contract. The route may append server-controlled flow
 * instructions or accepted-plan data to this base before applying the fixed
 * contracts once at the final model-input boundary.
 */
export function composeSystemPromptBase(
  systemPrompts: unknown,
  selectedMode: string,
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
  return contextualBase
}

/**
 * Apply the non-removable platform contracts to a complete system-prompt base.
 * The citation contract is conditional on a doc_query-style RAG tool; the
 * attachment, course, and language contracts are unconditional.
 */
export function applyFixedSystemPromptContracts(
  systemPromptBase: string,
  toolNames: readonly string[]
): string {
  const inputContext = withInputContextContract(systemPromptBase)
  const coursePolicy = withCoursePolicyContract(inputContext, toolNames)
  const citations = withCitationContract(coursePolicy, toolNames)
  return withLanguageStyleContract(citations)
}

/**
 * Compile a complete system prompt when no later system-level data or flow
 * instructions need to be inserted. Final request assembly should instead
 * compose its base first and apply the fixed contracts at the model boundary.
 */
export function compileSystemPrompt(
  systemPrompts: unknown,
  selectedMode: string,
  toolNames: readonly string[],
  runtimeContextBlocks: readonly string[] = []
): string {
  return applyFixedSystemPromptContracts(
    composeSystemPromptBase(systemPrompts, selectedMode, runtimeContextBlocks),
    toolNames
  )
}
