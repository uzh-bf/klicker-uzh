import { SAFE_TOOL_ERROR } from '../toolOutput'

export type PersistedAssistantContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args?: unknown
      result?: unknown
      isError?: boolean
    }

type UnfinishedAssistantContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }

export function mapAssistantStepContent(
  steps: Array<{ content?: unknown[] }> | undefined
): PersistedAssistantContentPart[] {
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

      if (
        (part.type === 'tool-error' || part.type === 'tool-result') &&
        typeof part.toolCallId === 'string'
      ) {
        const output =
          part.output && typeof part.output === 'object'
            ? (part.output as { isError?: unknown })
            : null
        const isError = part.type === 'tool-error' || output?.isError === true
        const result = isError ? SAFE_TOOL_ERROR : part.output
        const toolCallIndex = toolCallIndexById.get(part.toolCallId)
        if (toolCallIndex !== undefined) {
          const existingToolCall = content[toolCallIndex]
          if (existingToolCall?.type === 'tool-call') {
            existingToolCall.result = result
            if (isError) existingToolCall.isError = true
          }
          continue
        }

        if (typeof part.toolName !== 'string') {
          continue
        }

        const toolCallWithResult: PersistedAssistantContentPart = {
          type: 'tool-call' as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.type === 'tool-error' ? (part.input ?? {}) : {},
          result,
          ...(isError ? { isError: true } : {}),
        }
        content.push(toolCallWithResult)
        toolCallIndexById.set(part.toolCallId, content.length - 1)
      }
    }
  }

  return content
}

export function buildAbortedAssistantContent(
  steps: Array<{ content?: unknown[] }> | undefined,
  unfinishedContent: readonly UnfinishedAssistantContentPart[]
): PersistedAssistantContentPart[] {
  const content = mapAssistantStepContent(steps)

  for (const part of unfinishedContent) {
    if (part.text.trim()) {
      content.push(part)
    }
  }

  return content
}
