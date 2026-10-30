import { once } from 'node:events'
import { createServer } from 'node:http'
import { serve } from '@hono/node-server'
import {
  CHAT_ENGINE_CONTRACT_VERSION,
  conformanceToolRequest,
} from '@klicker-uzh/chat-engine-contract'
import { createDefaultEngineApp } from '@klicker-uzh/chat-engine-default'
import { MockLanguageModelV4 } from 'ai/test'
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

test.each([
  'complete',
  'tool',
  'next-step',
  'partial-next-step',
] as const)('settles native engine HTTP usage once after %s', async (phase) => {
  const upstreamAbort = vi.fn()
  const peerClosed = vi.fn()
  const beginPhase = vi.fn()
  let calls = 0
  const model = new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => {
      calls += 1
      const first = calls === 1
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] })
            if (first) {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'call-http',
                toolName: 'doc_query',
                input: '{"query":"synthetic"}',
              })
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
                usage: {
                  inputTokens: {
                    total: 12,
                    noCache: 12,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 4, text: 4, reasoning: undefined },
                },
              })
              controller.close()
              return
            }
            controller.enqueue({ type: 'text-start', id: 'text-http' })
            controller.enqueue({
              type: 'text-delta',
              id: 'text-http',
              delta: 'synthetic answer',
            })
            if (phase === 'complete') {
              controller.enqueue({ type: 'text-end', id: 'text-http' })
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 20,
                    noCache: 20,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 6, text: 6, reasoning: undefined },
                },
              })
              controller.close()
              return
            }
            beginPhase()
            abortSignal?.addEventListener(
              'abort',
              () => {
                upstreamAbort()
                if (phase === 'partial-next-step') {
                  controller.enqueue({
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: {
                      inputTokens: {
                        total: 9,
                        noCache: 9,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: undefined,
                        text: undefined,
                        reasoning: undefined,
                      },
                    },
                  })
                  controller.close()
                } else
                  controller.error(
                    new DOMException('Synthetic abort', 'AbortError')
                  )
              },
              { once: true }
            )
          },
        }),
      }
    },
  })
  const engine = createDefaultEngineApp({
    serviceToken: 'synthetic-service',
    modelFactory: () => model,
    toolExecutor: async ({ abortSignal }) => {
      if (phase === 'tool') {
        beginPhase()
        await new Promise<void>((_resolve, reject) => {
          const aborted = () => {
            upstreamAbort()
            reject(abortSignal.reason)
          }
          if (abortSignal.aborted) aborted()
          else abortSignal.addEventListener('abort', aborted, { once: true })
        })
      }
      return { evidence: 17 }
    },
  })
  const server = serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (request, environment) => {
      environment.outgoing.once('close', () =>
        peerClosed(!environment.outgoing.writableFinished)
      )
      return engine.fetch(request)
    },
  })
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No HTTP listener')
  const transport = new AbortController()
  const finalize = vi.fn(async (_state: StreamState) => ({
    creditsUsed: null,
    finalPersistenceStatus: 'not-persisted' as const,
  }))
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat`, {
      method: 'POST',
      signal: AbortSignal.any([transport.signal, AbortSignal.timeout(3_000)]),
      headers: {
        authorization: 'Bearer synthetic-service',
        'content-type': 'application/json',
        'x-mcp-execution-token': 'synthetic-run',
      },
      body: JSON.stringify(conformanceToolRequest),
    })
    const stream = createValidatedPlatformStream(response, {
      expected: {
        assistantMessageId: conformanceToolRequest.assistantMessageId,
        runId: conformanceToolRequest.runId,
        modelId: conformanceToolRequest.generation.modelId,
        deploymentId: conformanceToolRequest.generation.deploymentId,
      },
      metadata: () => ({
        chatMode: 'tutor',
        modelId: 'synthetic-model',
        reasoningEffort: null,
        userMessageId: 'user-1',
        assistantMessageId: 'assistant-1',
        creditsUsed: null,
        finalPersistenceStatus: 'not-persisted',
      }),
      finalize,
      onCancel: () => transport.abort(),
    })
    if (phase === 'complete') {
      const output = await read(stream)
      expect(output).not.toContain('INVALID_ENGINE_STREAM')
      expect(output).toContain('"type":"tool-output-available"')
      expect(finalize.mock.calls[0]?.[0]).toMatchObject({
        status: 'finished',
        usage: { inputTokens: 32, outputTokens: 10, totalTokens: 42 },
      })
    } else {
      const reader = stream.getReader()
      let output = ''
      const decoder = new TextDecoder()
      while (!output.includes('"totalTokens":16')) {
        const next = await reader.read()
        if (next.done)
          throw new Error('Engine ended before its completed usage snapshot')
        output += decoder.decode(next.value, { stream: true })
      }
      await vi.waitFor(() => expect(beginPhase).toHaveBeenCalledTimes(1))
      await reader.cancel('Synthetic participant Stop')
      reader.releaseLock()
      await vi.waitFor(() => expect(upstreamAbort).toHaveBeenCalledTimes(1))
      await vi.waitFor(() => expect(peerClosed).toHaveBeenCalledWith(true))
      expect(finalize.mock.calls[0]?.[0]).toMatchObject({
        status: 'aborted',
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      })
    }
    expect(finalize).toHaveBeenCalledTimes(1)
  } finally {
    transport.abort()
    if ('closeAllConnections' in server) server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test.each([
  'v1',
  'v2',
] as const)('keeps hidden reasoning canonical while suppressing every participant transport: %s', async (contractVersion) => {
  const finishMetadata = {
    ...metadata(),
    contractVersion,
    reasoningContent: 'synthetic private reasoning',
  }
  const finalize = vi.fn(async (_state: StreamState) => ({
    creditsUsed: 0,
    finalPersistenceStatus: 'persisted' as const,
  }))
  const response = await read(
    createValidatedPlatformStream(
      responseFor([
        {
          type: 'start',
          messageId: 'assistant-1',
          ...(contractVersion === 'v2'
            ? { messageMetadata: finishMetadata }
            : {}),
        },
        { type: 'reasoning-start', id: 'reason' },
        {
          type: 'reasoning-delta',
          id: 'reason',
          delta: finishMetadata.reasoningContent,
        },
        { type: 'reasoning-end', id: 'reason' },
        { type: 'text-start', id: 'answer' },
        { type: 'text-delta', id: 'answer', delta: 'synthetic answer' },
        { type: 'text-end', id: 'answer' },
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: finishMetadata,
        },
      ]),
      {
        contractVersion,
        showReasoning: false,
        finalize,
        metadata: () => ({
          chatMode: 'cm_hidden',
          modelId: 'model',
          reasoningEffort: 'low',
          userMessageId: 'user',
          assistantMessageId: 'assistant',
          creditsUsed: null,
          finalPersistenceStatus: 'not-persisted',
        }),
      }
    )
  )
  const parts = response
    .split('\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice(6)))
  expect(parts.some((part) => part.type.startsWith('reasoning-'))).toBe(false)
  expect(
    parts
      .filter((part) => part.messageMetadata)
      .every((part) => part.messageMetadata.reasoningContent === null)
  ).toBe(true)
  expect(finalize.mock.calls[0]?.[0].reasoning).toBe(
    finishMetadata.reasoningContent
  )
})
