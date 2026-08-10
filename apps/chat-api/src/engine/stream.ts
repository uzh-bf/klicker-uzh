import {
  parseEngineStreamPart,
  type EngineFinishMetadata,
  type EngineStreamPart,
  type EngineUsage,
} from '@klicker-uzh/chat-engine-contract'

const textEncoder = new TextEncoder()
const SAFE_TOOL_ERROR = 'Tool execution failed'
const SAFE_ENGINE_ERROR = 'The chat engine could not complete the request.'

export type PersistedAssistantPart =
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

export type StreamState = {
  text: string
  reasoning: string
  parts: PersistedAssistantPart[]
  usage: EngineUsage | null
  finishReason: string | null
  engineMetadata: EngineFinishMetadata | null
  status: 'streaming' | 'finished' | 'aborted' | 'error'
}

export type PlatformMetadata = {
  chatMode: string
  modelId: string
  reasoningEffort: string | null
  userMessageId: string
  assistantMessageId: string
  creditsUsed: number | null
  finalPersistenceStatus: 'persisted' | 'not-persisted' | 'not-applicable'
}

export type ValidatedStreamOptions = {
  onCancel?: () => void
  expected?: {
    assistantMessageId: string
    runId: string
    modelId: string
    deploymentId: string
  }
  metadata: (state: StreamState) => PlatformMetadata
  finalize: (
    state: StreamState
  ) => Promise<Pick<PlatformMetadata, 'creditsUsed' | 'finalPersistenceStatus'>>
}

class InvalidEngineStreamError extends Error {}

function validateIdentity(
  part: EngineStreamPart,
  expected: ValidatedStreamOptions['expected']
) {
  if (!expected) return
  if (
    part.type === 'start' &&
    part.messageId &&
    part.messageId !== expected.assistantMessageId
  ) {
    throw new InvalidEngineStreamError('Engine message identity mismatch.')
  }
  const metadata =
    part.type === 'finish' || part.type === 'message-metadata'
      ? part.messageMetadata
      : null
  if (!metadata) return
  if (
    metadata.runId !== expected.runId ||
    metadata.modelId !== expected.modelId ||
    metadata.deploymentId !== expected.deploymentId
  ) {
    throw new InvalidEngineStreamError('Engine terminal identity mismatch.')
  }
}

function emptyState(): StreamState {
  return {
    text: '',
    reasoning: '',
    parts: [],
    usage: null,
    finishReason: null,
    engineMetadata: null,
    status: 'streaming',
  }
}

function usageIsChargeable(usage: EngineUsage | null): usage is EngineUsage {
  return (
    usage !== null &&
    usage.inputTokens !== null &&
    usage.outputTokens !== null &&
    usage.totalTokens !== null &&
    [usage.inputTokens, usage.outputTokens, usage.totalTokens].every(
      (value) => Number.isInteger(value) && value >= 0
    )
  )
}

function toolPart(
  state: StreamState,
  toolCallId: string,
  toolName: string
): Extract<PersistedAssistantPart, { type: 'tool-call' }> {
  const existing = state.parts.find(
    (part): part is Extract<PersistedAssistantPart, { type: 'tool-call' }> =>
      part.type === 'tool-call' && part.toolCallId === toolCallId
  )
  if (existing) return existing
  const created = { type: 'tool-call' as const, toolCallId, toolName, args: {} }
  state.parts.push(created)
  return created
}

function isToolErrorOutput(output: unknown): boolean {
  return (
    output !== null &&
    typeof output === 'object' &&
    'isError' in output &&
    output.isError === true
  )
}

function consumePart(state: StreamState, part: EngineStreamPart) {
  switch (part.type) {
    case 'text-delta': {
      state.text += part.delta
      const previous = state.parts[state.parts.length - 1]
      if (previous?.type === 'text') previous.text = state.text
      else state.parts.push({ type: 'text', text: state.text })
      break
    }
    case 'reasoning-delta': {
      state.reasoning += part.delta
      const previous = state.parts[state.parts.length - 1]
      if (previous?.type === 'reasoning') previous.text += part.delta
      else state.parts.push({ type: 'reasoning', text: part.delta })
      break
    }
    case 'tool-input-start':
      toolPart(state, part.toolCallId, part.toolName)
      break
    case 'tool-input-available':
      toolPart(state, part.toolCallId, part.toolName).args = part.input
      break
    case 'tool-output-available':
      toolPart(state, part.toolCallId, 'unknown').result = isToolErrorOutput(
        part.output
      )
        ? SAFE_TOOL_ERROR
        : part.output
      if (isToolErrorOutput(part.output)) {
        toolPart(state, part.toolCallId, 'unknown').isError = true
      }
      break
    case 'tool-input-error': {
      const tool = toolPart(state, part.toolCallId, part.toolName)
      tool.args = part.input
      tool.result = SAFE_TOOL_ERROR
      tool.isError = true
      break
    }
    case 'tool-output-error': {
      const tool = toolPart(state, part.toolCallId, 'unknown')
      tool.result = SAFE_TOOL_ERROR
      tool.isError = true
      break
    }
    case 'finish':
      state.engineMetadata = part.messageMetadata
      state.usage = part.messageMetadata.usage
      state.finishReason = part.finishReason ?? null
      break
    case 'message-metadata':
      state.engineMetadata = part.messageMetadata
      state.usage = part.messageMetadata.usage
      break
    case 'abort':
      state.status = 'aborted'
      break
    case 'error':
      state.status = 'error'
      break
    default:
      break
  }
}

function encodeSse(value: unknown): Uint8Array {
  return textEncoder.encode(`data: ${JSON.stringify(value)}\n\n`)
}

function platformFinishPart(
  part: Extract<EngineStreamPart, { type: 'finish' }>,
  metadata: PlatformMetadata
) {
  return {
    type: 'finish',
    finishReason: part.finishReason,
    messageMetadata: { ...part.messageMetadata, ...metadata },
  }
}

function platformMetadataPart(
  part: Extract<EngineStreamPart, { type: 'message-metadata' }>,
  metadata: PlatformMetadata
) {
  return {
    type: 'message-metadata',
    messageMetadata: { ...part.messageMetadata, ...metadata },
  }
}

function streamError(code: string, errorText: string) {
  return { type: 'error', code, errorText, retryable: true }
}

function adaptPlatformPart(part: EngineStreamPart): EngineStreamPart {
  switch (part.type) {
    case 'tool-input-error':
      return { ...part, errorText: SAFE_TOOL_ERROR }
    case 'tool-output-error':
      return { ...part, errorText: SAFE_TOOL_ERROR }
    case 'tool-output-available':
      return {
        ...part,
        ...(isToolErrorOutput(part.output) ? { output: SAFE_TOOL_ERROR } : {}),
      }
    case 'error':
      return {
        type: 'error',
        code: 'ENGINE_STREAM_ERROR',
        errorText: SAFE_ENGINE_ERROR,
        retryable: false,
      }
    default:
      return part
  }
}

/**
 * Reads the engine's SSE stream once, validates every event, and emits only
 * browser-safe platform events. The terminal callback is guarded by this
 * function, so finish, abort, malformed input, and connection close cannot
 * persist or charge the same invocation twice.
 */
export function createValidatedPlatformStream(
  response: Response,
  options: ValidatedStreamOptions
): ReadableStream<Uint8Array> {
  if (!response.body) throw new Error('The chat engine returned no stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state = emptyState()
  let finalized: Promise<PlatformMetadata> | null = null
  let buffer = ''
  const activeTextIds = new Set<string>()
  const activeReasoningIds = new Set<string>()
  const startedTools = new Set<string>()
  let abortMetadataPending = false

  const finalizeOnce = async (): Promise<PlatformMetadata> => {
    if (!finalized) {
      finalized = options.finalize(state).then((result) => ({
        ...options.metadata(state),
        ...result,
      }))
    }
    return finalized
  }

  const consumeLine = async (
    line: string,
    controller: ReadableStreamDefaultController<Uint8Array>
  ) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(':')) return
    if (trimmed === 'data: [DONE]' || trimmed === '[DONE]') return

    const payload = trimmed.startsWith('data: ')
      ? trimmed.slice('data: '.length)
      : trimmed
    const parsed = parseEngineStreamPart(JSON.parse(payload))
    if (
      state.status !== 'streaming' &&
      !(
        state.status === 'aborted' &&
        abortMetadataPending &&
        parsed.type === 'abort'
      )
    ) {
      throw new InvalidEngineStreamError(
        'Engine stream emitted a part after its terminal event.'
      )
    }
    validateIdentity(parsed, options.expected)

    if (parsed.type === 'text-start') {
      if (activeTextIds.has(parsed.id))
        throw new InvalidEngineStreamError('Duplicate text start.')
      activeTextIds.add(parsed.id)
    }
    if (parsed.type === 'text-end') {
      if (!activeTextIds.delete(parsed.id))
        throw new InvalidEngineStreamError('Text end arrived before its start.')
    }
    if (parsed.type === 'reasoning-start') {
      if (activeReasoningIds.has(parsed.id))
        throw new InvalidEngineStreamError('Duplicate reasoning start.')
      activeReasoningIds.add(parsed.id)
    }
    if (parsed.type === 'reasoning-end') {
      if (!activeReasoningIds.delete(parsed.id))
        throw new InvalidEngineStreamError(
          'Reasoning end arrived before its start.'
        )
    }
    if (parsed.type === 'tool-input-start') {
      if (startedTools.has(parsed.toolCallId))
        throw new InvalidEngineStreamError('Duplicate tool input start.')
      startedTools.add(parsed.toolCallId)
    }
    if (
      (parsed.type === 'text-delta' && !activeTextIds.has(parsed.id)) ||
      (parsed.type === 'reasoning-delta' &&
        !activeReasoningIds.has(parsed.id)) ||
      ((parsed.type === 'tool-input-delta' ||
        parsed.type === 'tool-input-error' ||
        parsed.type === 'tool-input-available' ||
        parsed.type === 'tool-output-available' ||
        parsed.type === 'tool-output-error') &&
        !startedTools.has(parsed.toolCallId))
    ) {
      throw new InvalidEngineStreamError(
        'Engine stream part arrived out of order.'
      )
    }

    if (parsed.type === 'finish') {
      if (activeTextIds.size > 0 || activeReasoningIds.size > 0) {
        throw new InvalidEngineStreamError(
          'Engine stream finished before closing text parts.'
        )
      }
      consumePart(state, parsed)
      if (!usageIsChargeable(state.usage)) {
        state.status = 'error'
        await finalizeOnce()
        controller.enqueue(
          encodeSse(
            streamError(
              'INVALID_ENGINE_USAGE',
              'The chat engine returned incomplete usage data.'
            )
          )
        )
        controller.enqueue(textEncoder.encode('data: [DONE]\n\n'))
        await reader.cancel()
        controller.close()
        return
      }
      state.status = 'finished'
      const metadata = await finalizeOnce()
      controller.enqueue(encodeSse(platformFinishPart(parsed, metadata)))
      controller.enqueue(textEncoder.encode('data: [DONE]\n\n'))
      await reader.cancel()
      controller.close()
      return
    }

    consumePart(state, parsed)
    if (parsed.type === 'message-metadata' && parsed.messageMetadata.aborted) {
      state.status = 'aborted'
      abortMetadataPending = true
      const metadata = await finalizeOnce()
      controller.enqueue(encodeSse(platformMetadataPart(parsed, metadata)))
      return
    }

    if (parsed.type === 'abort') {
      const alreadyFinalized = finalized !== null
      const metadata = await finalizeOnce()
      if (!alreadyFinalized) {
        controller.enqueue(
          encodeSse({ type: 'message-metadata', messageMetadata: metadata })
        )
      }
      controller.enqueue(encodeSse(parsed))
      abortMetadataPending = false
      controller.enqueue(textEncoder.encode('data: [DONE]\n\n'))
      await reader.cancel()
      controller.close()
      return
    }

    if (parsed.type === 'error') {
      const alreadyFinalized = finalized !== null
      const metadata = await finalizeOnce()
      if (!alreadyFinalized) {
        controller.enqueue(
          encodeSse({ type: 'message-metadata', messageMetadata: metadata })
        )
      }
      controller.enqueue(encodeSse(adaptPlatformPart(parsed)))
      controller.enqueue(textEncoder.encode('data: [DONE]\n\n'))
      await reader.cancel()
      controller.close()
      return
    }

    controller.enqueue(encodeSse(adaptPlatformPart(parsed)))
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.length > 0) {
            const lastLine = buffer
            buffer = ''
            await consumeLine(lastLine, controller)
          }
          if (state.status === 'streaming') {
            state.status = 'error'
            controller.enqueue(
              encodeSse(
                streamError(
                  'ENGINE_STREAM_INCOMPLETE',
                  'The chat engine closed the stream before finishing.'
                )
              )
            )
            await finalizeOnce()
          }
          controller.enqueue(textEncoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          await consumeLine(line, controller)
          if (
            state.status === 'error' ||
            state.status === 'finished' ||
            (state.status === 'aborted' && !abortMetadataPending)
          )
            break
        }
      } catch (error) {
        if (state.status === 'streaming') {
          state.status = 'aborted'
          await finalizeOnce()
        }
        controller.enqueue(
          encodeSse(
            streamError(
              error instanceof InvalidEngineStreamError ||
                (error &&
                  typeof error === 'object' &&
                  'name' in error &&
                  (error as { name?: unknown }).name === 'ZodError')
                ? 'INVALID_ENGINE_STREAM'
                : 'ENGINE_STREAM_READ_FAILED',
              'The chat engine stream was invalid or interrupted.'
            )
          )
        )
        controller.enqueue(textEncoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
    async cancel() {
      options.onCancel?.()
      await reader.cancel()
      if (state.status === 'streaming') {
        state.status = 'aborted'
        await finalizeOnce()
      }
    },
  })
}

export { usageIsChargeable }
