import { createServer } from 'node:http'
import { CHAT_ENGINE_CONTRACT_VERSION } from '@klicker-uzh/chat-engine-contract'
import { describe, expect, test, vi } from 'vitest'
import {
  createValidatedPlatformStream,
  type StreamState,
} from '../src/engine/stream.js'

function responseFor(parts: unknown[]) {
  const body = parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join('')
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function chunkedResponse(chunks: string[]) {
  let index = 0
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++]
      if (chunk === undefined) controller.close()
      else controller.enqueue(new TextEncoder().encode(chunk))
    },
    cancel() {
      cancelled = true
    },
  })
  return {
    response: new Response(body, {
      headers: { 'content-type': 'text/event-stream' },
    }),
    wasCancelled: () => cancelled,
  }
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

  test.each([
    false,
    true,
  ])('cancels a rejected HTTP stream when finalization fails: %s', async (failFinalization) => {
    const upstreamCancel = vi.fn()
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write(
        `data: ${JSON.stringify({ type: 'text-delta', id: 'text-1', delta: 'rejected' })}\n\n`
      )
      response.on('close', upstreamCancel)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    try {
      const upstream = await fetch(`http://127.0.0.1:${address.port}`)
      const finalize = vi.fn(async () => {
        if (failFinalization) throw new Error('Synthetic persistence failure')
        return {
          creditsUsed: null,
          finalPersistenceStatus: 'not-persisted' as const,
        }
      })
      const onCancel = vi.fn()
      const stream = createValidatedPlatformStream(upstream, {
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
        onCancel,
      })

      const reading = read(stream)
      if (failFinalization) await expect(reading).rejects.toThrow()
      else {
        const parts = (await reading)
          .split('\n')
          .filter((line) => line.startsWith('data: {'))
          .map((line) => JSON.parse(line.slice(6)))
        expect(parts).toContainEqual(
          expect.objectContaining({
            type: 'error',
            code: 'INVALID_ENGINE_STREAM',
          })
        )
      }
      expect(finalize).toHaveBeenCalledTimes(1)
      await vi.waitFor(() => expect(upstreamCancel).toHaveBeenCalledTimes(1))
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(upstream.body?.locked).toBe(false)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
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
    const chunks = chunkedResponse([
      [
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'complete' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: metadata(),
        },
      ]
        .map((part) => `data: ${JSON.stringify(part)}\n\n`)
        .join(''),
      `data: ${JSON.stringify({ type: 'text-start', id: 'late-text' })}\n`,
    ])
    const stream = createValidatedPlatformStream(chunks.response, {
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
    })

    const text = await read(stream)
    expect(text).toContain('complete')
    expect(text).not.toContain('late-text')
    expect(text).toContain('data: [DONE]')
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(chunks.wasCancelled()).toBe(true)
  })
})

test('persists text segments without duplicating text across tool parts', async () => {
  const finalize = vi.fn(async (_state: StreamState) => ({
    creditsUsed: 0,
    finalPersistenceStatus: 'persisted' as const,
  }))
  const stream = createValidatedPlatformStream(
    responseFor([
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'A' },
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'calculate' },
      { type: 'text-delta', id: 'text-1', delta: 'B' },
      { type: 'text-delta', id: 'text-1', delta: 'C' },
      { type: 'text-end', id: 'text-1' },
      { type: 'finish', messageMetadata: metadata() },
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
  await read(stream)
  const state = finalize.mock.calls[0]![0]
  expect(state.text).toBe('ABC')
  expect(
    state.parts.filter((part) => part.type === 'text').map((part) => part.text)
  ).toEqual(['A', 'BC'])
})

test.each([
  'finish',
  'abort',
  'error',
])('closes once for an unterminated final %s frame', async (type) => {
  const finalize = vi.fn(async (_state: StreamState) => ({
    creditsUsed: 0,
    finalPersistenceStatus: 'persisted' as const,
  }))
  const part =
    type === 'finish'
      ? { type, messageMetadata: metadata() }
      : type === 'error'
        ? { type, errorText: 'synthetic failure' }
        : { type }
  const stream = createValidatedPlatformStream(
    new Response(`data: ${JSON.stringify(part)}`),
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
  const body = await read(stream)
  expect(body.match(/data: \[DONE\]/g)).toHaveLength(1)
  expect(finalize).toHaveBeenCalledTimes(1)
})

test.each([
  'close',
  'abort',
])('finalizes a pending read once when downstream cancellation causes %s', async (termination) => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let admit!: () => void
  const pending = new Promise<void>((resolve) => {
    admit = resolve
  })
  const upstream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value
    },
    pull() {
      admit()
      return new Promise<void>(() => {})
    },
  })
  const finalize = vi.fn(async (state: StreamState) => {
    expect(state.status).toBe('aborted')
    return {
      creditsUsed: null,
      finalPersistenceStatus: 'not-persisted' as const,
    }
  })
  const onCancel = vi.fn(() => {
    if (termination === 'abort')
      controller.error(new DOMException('Synthetic abort', 'AbortError'))
  })
  const stream = createValidatedPlatformStream(new Response(upstream), {
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
    onCancel,
  })
  const reader = stream.getReader()
  const reading = reader.read()
  await pending
  await reader.cancel()
  expect(await reading).toEqual({ done: true, value: undefined })
  expect(finalize).toHaveBeenCalledTimes(1)
  expect(onCancel).toHaveBeenCalledTimes(1)
  reader.releaseLock()
})
