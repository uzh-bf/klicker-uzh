import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

const INPUT_CONTEXT_CONTRACT = renderPromptTemplate('input-context', {})

/**
 * Appends the fixed interpretation of server-generated attachment descriptions
 * for every mode and stored persona.
 */
export function withInputContextContract(systemPrompt: string): string {
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${INPUT_CONTEXT_CONTRACT}`
    : INPUT_CONTEXT_CONTRACT
}
