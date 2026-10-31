import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

const OUTPUT_FORMAT_CONTRACT = renderPromptTemplate('output-format', {
  customPersona: false,
})
const CUSTOM_PERSONA_OUTPUT_FORMAT_CONTRACT = renderPromptTemplate(
  'output-format',
  { customPersona: true }
)

/**
 * Appends renderer-compatible output rules for every mode and stored persona.
 * A lecturer-defined persona may set its own format, such as plain spoken
 * prose; the notation rules the renderer depends on still apply.
 */
export function withOutputFormatContract(
  systemPrompt: string,
  customPersona = false
): string {
  const contract = customPersona
    ? CUSTOM_PERSONA_OUTPUT_FORMAT_CONTRACT
    : OUTPUT_FORMAT_CONTRACT
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0 ? `${trimmedBase}\n\n${contract}` : contract
}
