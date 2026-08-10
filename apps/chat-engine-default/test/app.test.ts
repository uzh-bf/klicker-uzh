import { MockLanguageModelV3 } from 'ai/test'
import { describe, expect, test } from 'vitest'
import {
  conformanceRequest,
  parseEngineStreamPart,
} from '@klicker-uzh/chat-engine-contract'
import { createDefaultEngineApp } from '../src/index.js'

function mockStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] })
      controller.enqueue({ type: 'text-start', id: 'text-1' })
      controller.enqueue({
        type: 'text-delta',
        id: 'text-1',
        delta: 'A bond is debt.',
      })
      controller.enqueue({ type: 'text-end', id: 'text-1' })
      controller.enqueue({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: {
            total: 12,
            noCache: 12,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 8, text: 8, reasoning: undefined },
        },
      })
      controller.close()
    },
  })
}

async function readParts(response: Response) {
  const body = await response.text()
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) =>
      parseEngineStreamPart(JSON.parse(line.slice('data: '.length)))
    )
}

describe('default chat engine', () => {
  test('serves a manifest and streams the normalized contract', async () => {
    const model = new MockLanguageModelV3({
      doStream: { stream: mockStream() },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
    })

    const manifestResponse = await app.request('/v1/manifest')
    expect(manifestResponse.status).toBe(200)
    expect((await manifestResponse.json()).contractVersion).toBe('v1')

    const response = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify(conformanceRequest),
    })
    expect(response.status).toBe(200)

    const parts = await readParts(response)
    expect(parts.find((part) => part.type === 'start')?.messageId).toBe(
      conformanceRequest.assistantMessageId
    )
    const finish = parts.find((part) => part.type === 'finish')
    expect(parts.some((part) => part.type === 'text-delta')).toBe(true)
    expect(
      finish?.type === 'finish' ? finish.messageMetadata.usage : null
    ).toMatchObject({
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20,
    })
    expect(model.doStreamCalls).toHaveLength(1)
  })

  test('rejects missing service, provider, and MCP credentials before streaming', async () => {
    const requestModeRequest = {
      ...conformanceRequest,
      generation: {
        ...conformanceRequest.generation,
        credentialMode: {
          mode: 'request' as const,
          providerBaseUrl: 'https://openrouter.ai/api/v1',
        },
      },
      tools: [
        {
          name: 'doc_query',
          description: 'Search course documents.',
          inputSchema: { type: 'object', properties: {} },
          serverId: 'doc-server',
        },
      ],
    }
    const model = new MockLanguageModelV3({
      doStream: { stream: mockStream() },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
    })

    const missingService = await app.request('/v1/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(conformanceRequest),
    })
    expect(missingService.status).toBe(401)

    const missingProvider = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestModeRequest),
    })
    expect(missingProvider.status).toBe(400)

    const missingMcpToken = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
        'provider-authorization': 'Bearer provider-secret',
      },
      body: JSON.stringify(requestModeRequest),
    })
    expect(missingMcpToken.status).toBe(400)
    expect(model.doStreamCalls).toHaveLength(0)
  })

  test('reconstructs persisted tool output and executes approved tools', async () => {
    const toolRequest = {
      ...conformanceRequest,
      messages: [
        conformanceRequest.messages[0],
        {
          id: 'assistant-tool-1',
          role: 'assistant' as const,
          parts: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-history-1',
              toolName: 'doc_query',
              input: { query: 'bond' },
              output: { text: 'A bond is debt.' },
            },
          ],
        },
        {
          id: 'assistant-tool-error-1',
          role: 'assistant' as const,
          parts: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-history-error-1',
              toolName: 'doc_query',
              input: { query: 'missing' },
              output: { error: 'unavailable' },
              isError: true,
            },
          ],
        },
      ],
      tools: [
        {
          name: 'doc_query',
          description: 'Search course documents.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
          serverId: 'doc-server',
        },
      ],
    }
    const executed: Array<Record<string, unknown>> = []
    let streamCallCount = 0
    let observedPrompt: unknown
    const model = new MockLanguageModelV3({
      doStream: async ({ abortSignal, prompt }) => {
        streamCallCount += 1
        if (streamCallCount === 1) observedPrompt = prompt
        return {
          stream:
            streamCallCount === 1
              ? new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] })
                    controller.enqueue({
                      type: 'tool-input-start',
                      id: 'call-current-1',
                      toolName: 'doc_query',
                    })
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: 'call-current-1',
                      delta: '{"query":"bond"}',
                    })
                    controller.enqueue({
                      type: 'tool-input-end',
                      id: 'call-current-1',
                    })
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: 'call-current-1',
                      toolName: 'doc_query',
                      input: '{"query":"bond"}',
                    })
                    controller.enqueue({
                      type: 'finish',
                      finishReason: {
                        unified: 'tool-calls',
                        raw: 'tool_calls',
                      },
                      usage: {
                        inputTokens: {
                          total: 12,
                          noCache: 12,
                          cacheRead: undefined,
                          cacheWrite: undefined,
                        },
                        outputTokens: {
                          total: 4,
                          text: 4,
                          reasoning: undefined,
                        },
                      },
                    })
                    controller.close()
                  },
                  cancel: () => abortSignal?.throwIfAborted(),
                })
              : mockStream(),
        }
      },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      toolExecutor: async ({ tool, input, token }) => {
        executed.push({ serverId: tool.serverId, input, token })
        return { text: 'A bond is debt.' }
      },
    })

    const response = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
        'x-mcp-execution-token': 'mcp-secret',
      },
      body: JSON.stringify(toolRequest),
    })

    expect(response.status).toBe(200)
    const parts = await readParts(response)
    expect(parts.some((part) => part.type === 'tool-output-available')).toBe(
      true
    )
    expect(executed).toEqual([
      {
        serverId: 'doc-server',
        input: { query: 'bond' },
        token: 'mcp-secret',
      },
    ])
    const toolResults = (
      observedPrompt as Array<{ role: string; content: unknown[] }>
    )
      .filter((message) => message.role === 'tool')
      .flatMap((message) => message.content)
    expect(toolResults).toContainEqual({
      type: 'tool-result',
      toolCallId: 'call-history-error-1',
      toolName: 'doc_query',
      output: { type: 'error-json', value: { error: 'unavailable' } },
    })
    expect(model.doStreamCalls).toHaveLength(2)
  })

  test('emits normalized abort metadata after client cancellation', async () => {
    const abortController = new AbortController()
    const abortRequest = {
      ...conformanceRequest,
      tools: [
        {
          name: 'doc_query',
          description: 'Search course documents.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
          serverId: 'doc-server',
        },
      ],
    }
    let streamCallCount = 0
    const model = new MockLanguageModelV3({
      doStream: async ({ abortSignal }) => {
        streamCallCount += 1
        if (streamCallCount === 1) {
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] })
                controller.enqueue({
                  type: 'tool-input-start',
                  id: 'call-abort-1',
                  toolName: 'doc_query',
                })
                controller.enqueue({
                  type: 'tool-input-delta',
                  id: 'call-abort-1',
                  delta: '{"query":"bond"}',
                })
                controller.enqueue({
                  type: 'tool-input-end',
                  id: 'call-abort-1',
                })
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'call-abort-1',
                  toolName: 'doc_query',
                  input: '{"query":"bond"}',
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
                    outputTokens: {
                      total: 4,
                      text: 4,
                      reasoning: undefined,
                    },
                  },
                })
                controller.close()
              },
            }),
          }
        }

        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] })
              controller.enqueue({ type: 'text-start', id: 'text-abort' })
              controller.enqueue({
                type: 'text-delta',
                id: 'text-abort',
                delta: 'A bond is',
              })
              abortSignal?.addEventListener(
                'abort',
                () => {
                  controller.enqueue({
                    type: 'finish',
                    finishReason: { unified: 'stop', raw: 'stop' },
                    usage: {
                      inputTokens: {
                        total: 12,
                        noCache: 12,
                        cacheRead: undefined,
                        cacheWrite: undefined,
                      },
                      outputTokens: {
                        total: 4,
                        text: 4,
                        reasoning: undefined,
                      },
                    },
                  })
                  controller.close()
                },
                { once: true }
              )
            },
          }),
        }
      },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      toolExecutor: async () => ({ text: 'A bond is debt.' }),
    })
    const request = new Request('http://engine/v1/chat', {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
        'x-mcp-execution-token': 'mcp-secret',
      },
      body: JSON.stringify(abortRequest),
    })

    const response = await app.fetch(request)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let body = ''
    while (model.doStreamCalls.length < 2) {
      const next = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_000)),
      ])
      if (next === null) throw new Error('Timed out waiting for second step.')
      if (next.done) throw new Error('Stream ended before the second step.')
      body += decoder.decode(next.value, { stream: true })
    }
    abortController.abort('client cancelled')

    for (;;) {
      const next = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_000)),
      ])
      if (next === null) throw new Error('Timed out waiting for abort stream.')
      if (next.done) break
      body += decoder.decode(next.value, { stream: true })
    }

    const parts = body
      .split('\n')
      .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
      .map((line) =>
        parseEngineStreamPart(JSON.parse(line.slice('data: '.length)))
      )
    const metadata = parts.find((part) => part.type === 'message-metadata')
    expect(
      metadata?.type === 'message-metadata' ? metadata.messageMetadata : null
    ).toMatchObject({
      aborted: true,
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
    })
    expect(parts.some((part) => part.type === 'abort')).toBe(true)
  })
})
