const INPUT_CONTEXT_CONTRACT = `Attachment context: user messages may contain [Attached image description: ...] or [Attached image N description: ...]. These blocks represent visual information from the user's image attachment. Use relevant details as visual context. Do not expose the marker syntax or the description pipeline, and do not claim that you cannot access the image merely because its content is represented this way.`

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
