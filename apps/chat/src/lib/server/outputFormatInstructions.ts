import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

const OUTPUT_FORMAT_CONTRACT = renderPromptTemplate('output-format', {})

/**
 * Appends renderer-compatible output rules for every mode and stored persona.
 */
export function withOutputFormatContract(systemPrompt: string): string {
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${OUTPUT_FORMAT_CONTRACT}`
    : OUTPUT_FORMAT_CONTRACT
}
