import { describe, expect, test, vi } from 'vitest'
import { CHAT_ENGINE_CONTRACT_VERSION } from '@klicker-uzh/chat-engine-contract'
import { createValidatedPlatformStream } from '../src/engine/stream.js'

function responseFor(parts: unknown[]) {
  const body = parts.map((part) => `data: ${JSON.stringify(part)}\n`).join('')
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function metadata(aborted = false) {
  return {
    contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    engineId: 'fake-engine',
    runId: 'run-1',
    modelId: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    usage: {
      inputTokens: 2,
      outputTokens: 1,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 3,
    },
    reasoningContent: null,
    aborted,
  }
}

async function read(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text()
}

describe('validated engine stream', () => {
  test('does not finalize twice when abort follows abort metadata', async () => {
    const finalize = vi.fn(async () => ({
      creditsUsed: 0.000001,
      finalPersistenceStatus: 'persisted' as const,
    }))
    const stream = createValidatedPlatformStream(
      responseFor([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'partial' },
        { type: 'message-metadata', messageMetadata: metadata(true) },
        { type: 'abort', reason: 'cancelled' },
      ]),
      {
        metadata: () => ({
          chatMode: 'tutor',
          modelId: 'gpt-4.1-mini',
          reasoningEffort: null,
          userMessageId: 'user-1',
          assistantMessageId: 'assistant-1',
          creditsUsed: null,
          finalPersistenceStatus: 'not-persisted',
        }),
        finalize,
      }
    )

    const text = await read(stream)
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(text.match(/"type":"message-metadata"/g)).toHaveLength(1)
    expect(text).toContain('"type":"abort"')
  })

  test('fails closed on an unknown part and emits no unknown payload', async () => {
    const finalize = vi.fn(async () => ({
      creditsUsed: null,
      finalPersistenceStatus: 'not-persisted' as const,
    }))
    const stream = createValidatedPlatformStream(
      responseFor([
        { type: 'private-provider-secret', value: 'do-not-forward' },
      ]),
      {
        metadata: () => ({
          chatMode: 'tutor',
          modelId: 'gpt-4.1-mini',
          reasoningEffort: null,
          userMessageId: 'user-1',
          assistantMessageId: 'assistant-1',
          creditsUsed: null,
          finalPersistenceStatus: 'not-persisted',
        }),
        finalize,
      }
    )

    const text = await read(stream)
    expect(text).toContain('INVALID_ENGINE_STREAM')
    expect(text).not.toContain('do-not-forward')
    expect(finalize).toHaveBeenCalledTimes(1)
  })

  test('fails closed when terminal metadata belongs to another run', async () => {
    const finalize = vi.fn(async () => ({
      creditsUsed: null,
      finalPersistenceStatus: 'not-persisted' as const,
    }))
    const stream = createValidatedPlatformStream(
      responseFor([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'wrong run' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: { ...metadata(), runId: 'other-run' },
        },
      ]),
      {
        expected: {
          assistantMessageId: 'assistant-1',
          runId: 'run-1',
          modelId: 'gpt-4.1-mini',
          deploymentId: 'gpt-4.1-mini',
        },
        metadata: () => ({
          chatMode: 'tutor',
          modelId: 'gpt-4.1-mini',
          reasoningEffort: null,
          userMessageId: 'user-1',
          assistantMessageId: 'assistant-1',
          creditsUsed: null,
          finalPersistenceStatus: 'not-persisted',
        }),
        finalize,
      }
    )

    const text = await read(stream)
    expect(text).toContain('INVALID_ENGINE_STREAM')
    expect(text).not.toContain('other-run')
    expect(finalize).toHaveBeenCalledTimes(1)
  })

  test('sanitizes known engine error payloads before forwarding them', async () => {
    const finalize = vi.fn(async () => ({
      creditsUsed: null,
      finalPersistenceStatus: 'not-persisted' as const,
    }))
    const stream = createValidatedPlatformStream(
      responseFor([
        {
          type: 'tool-input-start',
          toolCallId: 'call-1',
          toolName: 'doc_query',
        },
        {
          type: 'tool-input-error',
          toolCallId: 'call-1',
          toolName: 'doc_query',
          input: { query: 'bond' },
          errorText: 'provider-secret',
        },
        {
          type: 'error',
          code: 'provider_error',
          errorText: 'provider-secret',
          retryable: true,
        },
      ]),
      {
        metadata: () => ({
          chatMode: 'tutor',
          modelId: 'gpt-4.1-mini',
          reasoningEffort: null,
          userMessageId: 'user-1',
          assistantMessageId: 'assistant-1',
          creditsUsed: null,
          finalPersistenceStatus: 'not-persisted',
        }),
        finalize,
      }
    )

    const text = await read(stream)
    expect(text).not.toContain('provider-secret')
    expect(text).toContain('Tool execution failed')
    expect(text).toContain('The chat engine could not complete the request.')
  })

  test('closes after finish and rejects late upstream parts', async () => {
    const finalize = vi.fn(async () => ({
      creditsUsed: 0.000001,
      finalPersistenceStatus: 'persisted' as const,
    }))
    const stream = createValidatedPlatformStream(
      responseFor([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'complete' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: metadata(),
        },
        { type: 'text-start', id: 'late-text' },
      ]),
      {
        metadata: () => ({
          chatMode: 'tutor',
          modelId: 'gpt-4.1-mini',
          reasoningEffort: null,
          userMessageId: 'user-1',
          assistantMessageId: 'assistant-1',
          creditsUsed: null,
          finalPersistenceStatus: 'not-persisted',
        }),
        finalize,
      }
    )

    const text = await read(stream)
    expect(text).toContain('complete')
    expect(text).not.toContain('late-text')
    expect(text).toContain('data: [DONE]')
    expect(finalize).toHaveBeenCalledTimes(1)
  })
})
