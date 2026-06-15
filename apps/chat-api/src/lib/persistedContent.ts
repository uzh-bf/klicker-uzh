// Assistant-message content mapping, ported verbatim from the apps/chat route.
// It duck-types over a step's `content` array (text / reasoning / tool-call /
// tool-result parts, with tool args under `input` and results under `output`),
// which is exactly the shape of Mastra's LLMStepResult.content — so the same
// mapper that consumed AI SDK streamText steps consumes Mastra agent.stream
// steps unchanged. Kept identical to the route so persisted assistant messages
// are byte-compatible across the flag (reconciled in Phase 6).

export type PersistedAssistantContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args?: unknown
      result?: unknown
    }

export const normalizeReasoningContent = (
  value: string | null | undefined
): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

export const mapAssistantStepContent = (
  steps: Array<{ content?: unknown[] }> | undefined
): PersistedAssistantContentPart[] => {
  const content: PersistedAssistantContentPart[] = []
  const toolCallIndexById = new Map<string, number>()

  for (const step of steps ?? []) {
    if (!Array.isArray(step.content)) continue

    for (const rawPart of step.content) {
      if (!rawPart || typeof rawPart !== 'object') continue

      const part = rawPart as {
        type?: unknown
        text?: unknown
        toolCallId?: unknown
        toolName?: unknown
        input?: unknown
        output?: unknown
      }

      if (part.type === 'text' && typeof part.text === 'string') {
        content.push({ type: 'text', text: part.text })
        continue
      }

      if (part.type === 'reasoning' && typeof part.text === 'string') {
        content.push({ type: 'reasoning', text: part.text })
        continue
      }

      if (
        part.type === 'tool-call' &&
        typeof part.toolCallId === 'string' &&
        typeof part.toolName === 'string'
      ) {
        const nextToolCall = {
          type: 'tool-call' as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.input,
        }
        content.push(nextToolCall)
        toolCallIndexById.set(nextToolCall.toolCallId, content.length - 1)
        continue
      }

      if (part.type === 'tool-result' && typeof part.toolCallId === 'string') {
        const toolCallIndex = toolCallIndexById.get(part.toolCallId)
        if (toolCallIndex !== undefined) {
          const existingToolCall = content[toolCallIndex]
          if (existingToolCall?.type === 'tool-call') {
            existingToolCall.result = part.output
          }
          continue
        }

        if (typeof part.toolName !== 'string') {
          continue
        }

        const toolCallWithResult = {
          type: 'tool-call' as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: {},
          result: part.output,
        }
        content.push(toolCallWithResult)
        toolCallIndexById.set(part.toolCallId, content.length - 1)
      }
    }
  }

  return content
}
