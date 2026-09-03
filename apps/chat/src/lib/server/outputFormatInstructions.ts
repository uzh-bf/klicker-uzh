const OUTPUT_FORMAT_CONTRACT = `Output format: use valid Markdown when structure improves readability, while keeping the format proportionate to the answer.

Mathematics: write inline mathematics as $...$ and display mathematics as $$...$$ so the chat renderer can typeset it. Do not use square brackets as formula delimiters.

Code: put multi-line code in fenced code blocks and include the appropriate language identifier when known. Do not default every coding answer to one language. Never claim that code was executed or invent runtime output; clearly label illustrative or expected output.`

/**
 * Appends renderer-compatible output rules for every mode and stored persona.
 */
export function withOutputFormatContract(systemPrompt: string): string {
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${OUTPUT_FORMAT_CONTRACT}`
    : OUTPUT_FORMAT_CONTRACT
}
