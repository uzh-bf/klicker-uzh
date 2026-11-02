import { once } from 'node:events'
import { createServer } from 'node:http'
import { serve } from '@hono/node-server'
import {
  conformanceAbortRequest,
  conformanceRequest,
  conformanceRequestCredentialRequest,
  conformanceToolRequest,
  conformanceV2AbortRequest,
  conformanceV2Request,
  conformanceV2RequestCredentialRequest,
  conformanceV2ToolRequest,
  type EngineContractVersion,
  engineToolExecutionV2RequestSchema,
  engineToolProjectionV2RequestSchema,
  parseEngineStreamPart,
  runChatEngineConformanceSuite,
} from '@klicker-uzh/chat-engine-contract'
import { MockLanguageModelV3, MockLanguageModelV4 } from 'ai/test'
import { Hono } from 'hono'
import { describe, expect, test, vi } from 'vitest'
import { createDefaultEngineApp } from '../src/index.js'
import {
  createProviderModel,
  providerOptionsForGeneration,
} from '../src/provider.js'

function mockStream(
  inputTokens = 12,
  outputTokens = 8,
  text = 'A bond is debt.'
) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] })
      controller.enqueue({ type: 'text-start', id: 'text-1' })
      controller.enqueue({
        type: 'text-delta',
        id: 'text-1',
        delta: text,
      })
      controller.enqueue({ type: 'text-end', id: 'text-1' })
      controller.enqueue({
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: {
            total: inputTokens,
            noCache: inputTokens,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: outputTokens,
            text: outputTokens,
            reasoning: undefined,
          },
        },
      })
      controller.close()
    },
  })
}

async function readParts(
  response: Response,
  version: EngineContractVersion = 'v1'
) {
  const body = await response.text()
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) =>
      parseEngineStreamPart(JSON.parse(line.slice('data: '.length)), version)
    )
}

function toolStream(parts: Array<Record<string, unknown>>) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] })
      for (const part of parts) controller.enqueue(part)
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
    },
  })
}

const projectionRequest = {
  ...conformanceV2Request,
  messages: [
    conformanceRequest.messages[0]!,
    {
      id: 'assistant-history',
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-call' as const,
          toolCallId: 'history',
          toolName: 'doc_query',
          input: { query: 'history' },
          output: { source: 'history-raw' },
          modelOutput: {
            type: 'json' as const,
            value: { source: 'history-model' },
          },
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
  stepPolicy: { trailingSystemMessage: 'reminder', projectToolResults: true },
}

const projectionHeaders = {
  authorization: 'Bearer service-secret',
  'content-type': 'application/json',
  'x-mcp-execution-token': 'mcp-secret',
}

function interleavedCalls(atomicSecond = false) {
  return toolStream([
    { type: 'tool-input-start', id: 'a', toolName: 'doc_query' },
    ...(atomicSecond
      ? []
      : [
          { type: 'tool-input-start', id: 'b', toolName: 'doc_query' },
          { type: 'tool-input-delta', id: 'b', delta: '{"query":"b"}' },
          { type: 'tool-input-end', id: 'b' },
        ]),
    {
      type: 'tool-call',
      toolCallId: 'b',
      toolName: 'doc_query',
      input: '{"query":"b"}',
    },
    { type: 'tool-input-delta', id: 'a', delta: '{"query":"a"}' },
    { type: 'tool-input-end', id: 'a' },
    {
      type: 'tool-call',
      toolCallId: 'a',
      toolName: 'doc_query',
      input: '{"query":"a"}',
    },
  ])
}

function atomicCall(id: string, input = `{"query":"${id}"}`) {
  return toolStream([
    { type: 'tool-call', toolCallId: id, toolName: 'doc_query', input },
  ])
}

function projectedOutputs(ids: string[]) {
  return {
    contractVersion: 'v2',
    outputs: ids.map((toolCallId, index) => ({
      toolCallId,
      modelOutput: {
        type: 'json',
        value: { source: toolCallId, citation: index + 1 },
      },
    })),
  }
}

function modelToolResults(prompt: Array<{ role: string; content: unknown }>) {
  return prompt.flatMap((message) =>
    message.role === 'tool' && Array.isArray(message.content)
      ? message.content
      : []
  ) as Array<{ toolCallId: string; output: unknown }>
}

describe('default chat engine', () => {
  test.each([
    [0, 0, 'test-provider-reply', 'test-replacement'],
    [20, 5, 'test-provider-reply', 'test-provider-reply'],
    [0, 0, 'x'.repeat(121), 'x'.repeat(121)],
  ])('applies the host unbilled-reply policy only to a short unbilled step (%s, %s)', async (inputTokens, outputTokens, text, expected) => {
    const model = new MockLanguageModelV3({
      doStream: { stream: mockStream(inputTokens, outputTokens, text) },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
    })
    const response = await app.request('/v2/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...conformanceV2Request,
        stepPolicy: {
          trailingSystemMessage: 'test-policy-1',
          unbilledReplyReplacement: 'test-replacement',
        },
      }),
    })
    expect(response.status).toBe(200)
    const parts = await readParts(response, 'v2')
    expect(
      parts
        .filter((part) => part.type === 'text-delta')
        .map((part) => part.delta)
        .join('')
    ).toBe(expected)
    const finish = parts.find((part) => part.type === 'finish')
    expect(finish?.messageMetadata.usage).toMatchObject({
      inputTokens,
      outputTokens,
    })
  })

  test.each([
    'responses',
    'chat',
  ] as const)('uses explicit %s transport independently of reasoning', (providerApi) => {
    const generation = {
      ...conformanceV2Request.generation,
      reasoningEffort: 'none',
      reasoningSummary: 'none' as const,
      providerApi,
      responseStorage: false,
    }
    const model = createProviderModel(generation, 'synthetic-key', {
      deploymentBaseUrl: 'https://provider.invalid/v1',
    })
    if (typeof model === 'string')
      throw new Error('Expected a constructed provider model')
    expect(model.provider).toBe(`openai.${providerApi}`)
    expect(providerOptionsForGeneration(generation)).toEqual({
      openai: providerApi === 'responses' ? { store: false } : {},
    })
  })

  test.each([
    'v1',
    'v2',
  ] as const)('serves the explicitly selected %s contract', async (version) => {
    const model = new MockLanguageModelV3({
      doStream: { stream: mockStream() },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
    })

    const manifestResponse = await app.request(`/${version}/manifest`)
    expect(manifestResponse.status).toBe(200)
    expect(await manifestResponse.json()).toMatchObject({
      contractVersion: version,
      providerCredentialModes: ['gateway', 'deployment'],
      limits: {
        maxMessages: 100,
        maxTools: 64,
        maxImageAttachments: 3,
        maxDecodedImageBytes: 5 * 1024 * 1024,
        maxDataUrlLength: 7_000_000,
      },
    })

    const response = await app.request(`/${version}/chat`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...conformanceRequest, contractVersion: version }),
    })
    expect(response.status).toBe(200)

    const parts = await readParts(response, version)
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

  test.each([
    {
      deploymentRequest: conformanceRequest,
      requestCredentialRequest: conformanceRequestCredentialRequest,
      toolRequest: conformanceToolRequest,
      abortRequest: conformanceAbortRequest,
    },
    {
      deploymentRequest: conformanceV2Request,
      requestCredentialRequest: conformanceV2RequestCredentialRequest,
      toolRequest: conformanceV2ToolRequest,
      abortRequest: conformanceV2AbortRequest,
    },
  ])('passes canonical $deploymentRequest.contractVersion conformance over HTTP', async (requests) => {
    const upstreamAbort = vi.fn()
    const executeTool = vi.fn(async ({ contractVersion }) =>
      contractVersion === 'v2'
        ? {
            output: { evidence: 17 },
            modelOutput: { type: 'text', value: '17' },
          }
        : { evidence: 17 }
    )
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      providerAllowedOrigins: new Set(['https://provider.example.test']),
      toolExecutor: executeTool,
      modelFactory: (generation) => {
        let calls = 0
        return new MockLanguageModelV4({
          doStream: async ({ tools, abortSignal }) => {
            calls += 1
            if (generation.modelId === 'conformance-abort') {
              return {
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] })
                    controller.enqueue({ type: 'text-start', id: 'text-abort' })
                    controller.enqueue({
                      type: 'text-delta',
                      id: 'text-abort',
                      delta: 'partial',
                    })
                    abortSignal?.addEventListener(
                      'abort',
                      () => {
                        upstreamAbort()
                        controller.error(
                          new DOMException('Synthetic abort', 'AbortError')
                        )
                      },
                      { once: true }
                    )
                  },
                }),
              }
            }
            if (tools?.length && calls === 1) {
              return {
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] })
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: 'call-http',
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
                }),
              }
            }
            return { stream: mockStream() }
          },
        })
      },
    })
    const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    try {
      const result = await runChatEngineConformanceSuite({
        ...requests,
        abortRequest: {
          ...requests.abortRequest,
          generation: {
            ...requests.abortRequest.generation,
            modelId: 'conformance-abort',
          },
        },
        baseUrl: `http://127.0.0.1:${address.port}`,
        serviceToken: 'service-secret',
        requestProviderAuthorization: 'Bearer synthetic-provider',
        mcpExecutionToken: 'synthetic-mcp',
        traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
        tracestate: 'synthetic=1',
      })
      expect(result.manifest.contractVersion).toBe(
        requests.deploymentRequest.contractVersion
      )
      expect(result.transportCancelled).toBe(true)
      expect(executeTool).toHaveBeenCalledTimes(1)
      await vi.waitFor(() => expect(upstreamAbort).toHaveBeenCalledTimes(1))
    } finally {
      if ('closeAllConnections' in server) server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test('forwards ordinary images, current pages and full split document text to the model', async () => {
    const textParts = ['a'.repeat(160_000), 'b'.repeat(80_000)]
    const images = Array.from({ length: 13 }, (_, index) => {
      const mediaType =
        index < 3 ? ('image/png' as const) : ('image/jpeg' as const)
      return {
        id: `image-${index}`,
        type: 'image' as const,
        source:
          index < 3 ? ('attachment' as const) : ('document-page' as const),
        mediaType,
        dataUrl: `data:${mediaType};base64,${Buffer.from([index + 1]).toString('base64')}`,
      }
    })
    const request = {
      ...conformanceRequest,
      contractVersion: 'v2',
      messages: [
        {
          id: conformanceRequest.userMessageId,
          role: 'user',
          parts: [
            ...textParts.map((text) => ({ type: 'text', text })),
            ...images,
          ],
        },
      ],
    }
    const model = new MockLanguageModelV4({
      doStream: { stream: mockStream() },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
    })
    const response = await app.request('/v2/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    expect(response.status).toBe(200)
    await readParts(response, 'v2')
    const userMessage = model.doStreamCalls[0]?.prompt.find(
      (message) => message.role === 'user'
    )
    expect(
      userMessage?.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('')
    ).toBe(textParts.join(''))
    const files = userMessage?.content.filter((part) => part.type === 'file')
    expect(files).toHaveLength(images.length)
    files?.forEach((part, index) => {
      expect(part.mediaType).toBe(images[index]?.mediaType)
      expect(part.data.type).toBe('data')
      if (part.data.type !== 'data')
        throw new Error('Expected inline image bytes')
      const bytes =
        typeof part.data.data === 'string'
          ? Buffer.from(part.data.data, 'base64')
          : Buffer.from(part.data.data)
      expect(bytes).toEqual(Buffer.from([index + 1]))
    })
  })

  test.each([
    'v1',
    'v2',
  ] as const)('rejects a mismatched body generation on %s without calling the model', async (version) => {
    const modelFactory = vi.fn()
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory,
    })
    const response = await app.request(`/${version}/chat`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...conformanceRequest,
        contractVersion: version === 'v1' ? 'v2' : 'v1',
      }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      contractVersion: version,
      error: { code: 'INVALID_ENGINE_REQUEST' },
    })
    expect(modelFactory).not.toHaveBeenCalled()
  })

  test('authenticates v2 before applying its request-size admission', async () => {
    const modelFactory = vi.fn()
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory,
    })
    for (const authorized of [false, true]) {
      const response = await app.request('/v2/chat', {
        method: 'POST',
        headers: {
          ...(authorized ? { authorization: 'Bearer service-secret' } : {}),
          'content-length': String(65 * 1024 * 1024),
          'content-type': 'application/json',
        },
        body: '{}',
      })
      expect(response.status).toBe(authorized ? 413 : 401)
      expect(await response.json()).toMatchObject({ contractVersion: 'v2' })
    }
    expect(modelFactory).not.toHaveBeenCalled()
  })

  test('rejects request credentials for provider origins outside the engine allowlist', async () => {
    const requestModeRequest = {
      ...conformanceRequest,
      generation: {
        ...conformanceRequest.generation,
        credentialMode: {
          mode: 'gateway' as const,
          gatewayOrigin: 'https://untrusted.example.test/v1',
        },
      },
    }
    const model = new MockLanguageModelV3({
      doStream: { stream: mockStream() },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      providerAllowedOrigins: new Set(['https://provider.example.test']),
      modelFactory: () => model,
    })

    const response = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
        'provider-authorization': 'Bearer provider-secret',
      },
      body: JSON.stringify(requestModeRequest),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: 'PROVIDER_ORIGIN_NOT_ALLOWED' },
    })
    expect(model.doStreamCalls).toHaveLength(0)
  })

  test('rejects missing service, provider, and MCP credentials before streaming', async () => {
    const requestModeRequest = {
      ...conformanceRequest,
      generation: {
        ...conformanceRequest.generation,
        credentialMode: {
          mode: 'gateway' as const,
          gatewayOrigin: 'https://openrouter.ai/api/v1',
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
      providerAllowedOrigins: new Set(['https://openrouter.ai']),
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
    expect(await missingMcpToken.json()).toMatchObject({
      error: { code: 'MCP_TOKEN_REQUIRED' },
    })
    expect(model.doStreamCalls).toHaveLength(0)
  })

  test.each([
    { version: 'v1' as const, projection: undefined },
    {
      version: 'v2' as const,
      projection: {
        type: 'text' as const,
        value: JSON.stringify({ evidence: 17 }),
      },
    },
    {
      version: 'v2' as const,
      projection: {
        type: 'content' as const,
        value: [
          { type: 'text' as const, text: JSON.stringify({ evidence: 17 }) },
        ],
      },
    },
  ])('replays and executes $version tools with the selected projection', async ({
    version,
    projection,
  }) => {
    const toolRequest = {
      ...conformanceRequest,
      contractVersion: version,
      messages: [
        conformanceRequest.messages[0],
        {
          id: 'assistant-tool-1',
          role: 'assistant' as const,
          parts: [
            { type: 'text' as const, text: 'Retained preamble' },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-history-unfinished',
              toolName: 'doc_query',
              input: { query: 'unfinished' },
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-history-1',
              toolName: 'doc_query',
              input: { query: 'bond' },
              output: { text: 'A bond is debt.' },
              ...(version === 'v2'
                ? {
                    modelOutput: {
                      type: 'text',
                      value: JSON.stringify({ evidence: 11 }),
                    },
                  }
                : {}),
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
    if (toolRequest.contractVersion === 'v2')
      Object.assign(toolRequest, {
        stepPolicy: {
          firstToolName: 'doc_query',
          trailingSystemMessage: 'test-policy-1',
        },
      })
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
        return version === 'v2'
          ? {
              output: { text: 'A bond is debt.' },
              modelOutput: projection,
            }
          : { text: 'A bond is debt.' }
      },
    })

    const response = await app.request(`/${version}/chat`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-secret',
        'content-type': 'application/json',
        'x-mcp-execution-token': 'mcp-secret',
      },
      body: JSON.stringify(toolRequest),
    })

    expect(response.status).toBe(200)
    const parts = await readParts(response, version)
    expect(parts.some((part) => part.type === 'tool-output-available')).toBe(
      true
    )
    expect(
      parts.find((part) => part.type === 'tool-output-available')?.output
    ).toEqual({ text: 'A bond is debt.' })
    if (version === 'v2') {
      expect(model.doStreamCalls[0]?.toolChoice).toEqual({
        type: 'tool',
        toolName: 'doc_query',
      })
      expect(model.doStreamCalls[1]?.toolChoice).toEqual({ type: 'auto' })
      for (const call of model.doStreamCalls) {
        expect(call.prompt.at(-1)).toEqual({
          role: 'system',
          content: 'test-policy-1',
        })
        expect(
          call.prompt.filter(
            (message) =>
              message.role === 'system' && message.content === 'test-policy-1'
          )
        ).toHaveLength(1)
      }
    }
    const nextToolParts = model.doStreamCalls[1]?.prompt
      .filter((message) => message.role === 'tool')
      .flatMap((message) => message.content)
    expect(nextToolParts).toContainEqual(
      expect.objectContaining({
        toolCallId: 'call-current-1',
        output: projection ?? {
          type: 'json',
          value: { text: 'A bond is debt.' },
        },
      })
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
      toolCallId: 'call-history-1',
      toolName: 'doc_query',
      output:
        version === 'v2'
          ? { type: 'text', value: JSON.stringify({ evidence: 11 }) }
          : { type: 'json', value: { text: 'A bond is debt.' } },
    })
    expect(toolResults).toContainEqual({
      type: 'tool-result',
      toolCallId: 'call-history-error-1',
      toolName: 'doc_query',
      output: { type: 'error-json', value: { error: 'unavailable' } },
    })
    const assistantParts = (
      observedPrompt as Array<{ role: string; content: unknown[] }>
    )
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
    expect(assistantParts).toContainEqual({
      type: 'text',
      text: 'Retained preamble',
    })
    expect(assistantParts).not.toContainEqual(
      expect.objectContaining({ toolCallId: 'call-history-unfinished' })
    )
    expect(model.doStreamCalls).toHaveLength(2)
  })

  test.each([
    { version: 'v3' as const, atomicSecond: false },
    { version: 'v4' as const, atomicSecond: false },
    { version: 'v4' as const, atomicSecond: true },
  ])('projects delivered calls in UI start order across $version model steps (atomic second: $atomicSecond)', async ({
    version,
    atomicSecond,
  }) => {
    const arrivals: string[] = []
    const completions: string[] = []
    const projections: string[][] = []
    const host = new Hono()
    host.post('/v2/tools/execute', async (c) => {
      expect(c.req.header('authorization')).toBe('Bearer mcp-secret')
      const request = engineToolExecutionV2RequestSchema.parse(
        await c.req.json()
      )
      arrivals.push(request.toolCallId)
      if (request.toolCallId === 'a')
        await new Promise((resolve) => setTimeout(resolve, 50))
      completions.push(request.toolCallId)
      return c.json({
        output: { source: request.toolCallId, raw: true },
        modelOutput: { type: 'json', value: { baseline: request.toolCallId } },
      })
    })
    host.post('/v2/tools/project', async (c) => {
      expect(c.req.header('authorization')).toBe('Bearer mcp-secret')
      const request = engineToolProjectionV2RequestSchema.parse(
        await c.req.json()
      )
      projections.push(request.toolCallIds)
      return c.json(projectedOutputs(request.toolCallIds))
    })
    const server = serve({ fetch: host.fetch, port: 0, hostname: '127.0.0.1' })
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    let calls = 0
    const doStream = async () => {
      calls += 1
      return {
        stream:
          calls === 1
            ? interleavedCalls(atomicSecond)
            : calls === 2
              ? atomicCall('c')
              : mockStream(),
      }
    }
    const model =
      version === 'v3'
        ? new MockLanguageModelV3({ doStream })
        : new MockLanguageModelV4({ doStream })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      mcpExecutionUrl: `http://127.0.0.1:${address.port}/v2/tools/execute`,
      modelFactory: () => model,
    })
    try {
      const response = await app.request('/v2/chat', {
        method: 'POST',
        headers: projectionHeaders,
        body: JSON.stringify(projectionRequest),
      })
      const parts = await readParts(response, 'v2')
      expect(
        parts
          .filter((part) => part.type === 'tool-input-start')
          .map((part) => part.toolCallId)
      ).toEqual(['a', 'b', 'c'])
      expect(arrivals).toEqual(['b', 'a', 'c'])
      expect(completions).toEqual(['b', 'a', 'c'])
      expect(projections).toEqual([
        ['a', 'b'],
        ['a', 'b', 'c'],
      ])
      for (const id of ['a', 'b', 'c']) {
        expect(parts).toContainEqual(
          expect.objectContaining({
            type: 'tool-output-available',
            toolCallId: id,
            output: { source: id, raw: true },
          })
        )
      }
      expect(model.doStreamCalls).toHaveLength(3)
      for (const [index, ids] of [
        [1, ['a', 'b']],
        [2, ['a', 'b', 'c']],
      ] as const) {
        const results = modelToolResults(model.doStreamCalls[index]!.prompt)
        expect(
          results.find((item) => item.toolCallId === 'history')?.output
        ).toEqual({ type: 'json', value: { source: 'history-model' } })
        for (const [position, id] of ids.entries()) {
          expect(
            results.find((item) => item.toolCallId === id)?.output
          ).toEqual({
            type: 'json',
            value: { source: id, citation: position + 1 },
          })
        }
        expect(model.doStreamCalls[index]!.prompt.at(-1)).toEqual({
          role: 'system',
          content: 'reminder',
        })
      }
    } finally {
      if ('closeAllConnections' in server) server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test('excludes malformed or lost host receipts and SDK-local invalid calls', async () => {
    let calls = 0
    const hostSuccesses: string[] = []
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      const payload = engineToolExecutionV2RequestSchema.parse(
        JSON.parse(Buffer.concat(chunks).toString())
      )
      hostSuccesses.push(payload.toolCallId)
      if (payload.toolCallId === 'lost') {
        request.socket.destroy()
        return
      }
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify(
          payload.toolCallId === 'malformed'
            ? { output: { raw: true }, unexpected: true }
            : payload.toolCallId === 'oversized'
              ? { output: { raw: 'x'.repeat(8 * 1024 * 1024) } }
              : { output: { source: payload.toolCallId, raw: true } }
        )
      )
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    const projector = vi.fn(
      async ({ toolCallIds }: { toolCallIds: string[] }) =>
        projectedOutputs(toolCallIds)
    )
    const model = new MockLanguageModelV3({
      doStream: async () => {
        calls += 1
        return {
          stream:
            calls === 1
              ? toolStream([
                  {
                    type: 'tool-call',
                    toolCallId: 'lost',
                    toolName: 'doc_query',
                    input: '{"query":"lost"}',
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'bad-input',
                    toolName: 'doc_query',
                    input: '{"query":',
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'malformed',
                    toolName: 'doc_query',
                    input: '{"query":"malformed"}',
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'oversized',
                    toolName: 'doc_query',
                    input: '{"query":"oversized"}',
                  },
                  {
                    type: 'tool-call',
                    toolCallId: 'good',
                    toolName: 'doc_query',
                    input: '{"query":"good"}',
                  },
                ])
              : mockStream(),
        }
      },
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      toolProjector: projector,
      mcpExecutionUrl: `http://127.0.0.1:${address.port}/v2/tools/execute`,
    })
    try {
      const response = await app.request('/v2/chat', {
        method: 'POST',
        headers: projectionHeaders,
        body: JSON.stringify(projectionRequest),
      })
      const parts = await readParts(response, 'v2')
      expect(hostSuccesses).toEqual(['lost', 'malformed', 'oversized', 'good'])
      expect(projector).toHaveBeenCalledTimes(1)
      expect(projector.mock.calls[0]![0].toolCallIds).toEqual(['good'])
      expect(parts).toContainEqual(
        expect.objectContaining({
          type: 'tool-output-available',
          toolCallId: 'good',
          output: { source: 'good', raw: true },
        })
      )
      expect(
        parts
          .filter(
            (part) =>
              part.type === 'tool-output-error' ||
              part.type === 'tool-input-error'
          )
          .map((part) => part.toolCallId)
      ).toEqual(
        expect.arrayContaining(['lost', 'malformed', 'oversized', 'bad-input'])
      )
      expect(model.doStreamCalls).toHaveLength(2)
      expect(
        modelToolResults(model.doStreamCalls[1]!.prompt).find(
          (item) => item.toolCallId === 'good'
        )?.output
      ).toEqual({ type: 'json', value: { source: 'good', citation: 1 } })
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test.each([
    [
      'missing',
      {
        contractVersion: 'v2',
        outputs: [
          { toolCallId: 'a', modelOutput: { type: 'json', value: {} } },
        ],
      },
    ],
    ['extra', projectedOutputs(['a', 'b', 'foreign'])],
    ['duplicate', projectedOutputs(['a', 'a'])],
    ['reordered', projectedOutputs(['b', 'a'])],
    [
      'malformed',
      {
        contractVersion: 'v2',
        outputs: [{ toolCallId: 'a', modelOutput: { type: 'unknown' } }],
      },
    ],
  ])('rejects %s projections before another model call', async (_label, projection) => {
    let calls = 0
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: ++calls === 1 ? interleavedCalls() : mockStream(),
      }),
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      toolExecutor: async ({ toolCallId }) => ({
        output: { source: toolCallId },
      }),
      toolProjector: async () => projection,
    })
    const response = await app.request('/v2/chat', {
      method: 'POST',
      headers: projectionHeaders,
      body: JSON.stringify(projectionRequest),
    })
    const parts = await readParts(response, 'v2')
    expect(model.doStreamCalls).toHaveLength(1)
    expect(parts.some((part) => part.type === 'error')).toBe(true)
    expect(
      parts.some(
        (part) =>
          part.type === 'message-metadata' &&
          part.messageMetadata.usage.inputTokens === 12
      )
    ).toBe(true)
  })

  test.each([
    'oversized',
    'chunked',
    'redirect',
  ] as const)('rejects a %s host projection response', async (mode) => {
    let calls = 0
    let redirectTargetCalls = 0
    const host = new Hono()
    host.post('/v2/tools/project', (c) => {
      if (mode === 'redirect') return c.redirect('/redirect-target', 307)
      if (mode === 'chunked') {
        const encoder = new TextEncoder()
        const block = encoder.encode('x'.repeat(64 * 1024))
        let chunk = 0
        return new Response(
          new ReadableStream({
            pull(controller) {
              if (chunk === 0) {
                controller.enqueue(
                  encoder.encode(
                    '{"contractVersion":"v2","outputs":[{"toolCallId":"a","modelOutput":{"type":"json","value":"'
                  )
                )
              } else if (chunk <= 256) {
                controller.enqueue(block)
              } else {
                controller.enqueue(encoder.encode('"}}]}'))
                controller.close()
              }
              chunk += 1
            },
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('x', {
        headers: { 'content-length': String(16 * 1024 * 1024 + 1) },
      })
    })
    host.post('/redirect-target', (c) => {
      redirectTargetCalls += 1
      return c.json(projectedOutputs(['a']))
    })
    const server = serve({ fetch: host.fetch, port: 0, hostname: '127.0.0.1' })
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: ++calls === 1 ? atomicCall('a') : mockStream(),
      }),
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      mcpExecutionUrl: `http://127.0.0.1:${address.port}/v2/tools/execute`,
      toolExecutor: async () => ({ output: { raw: true } }),
    })
    try {
      const response = await app.request('/v2/chat', {
        method: 'POST',
        headers: projectionHeaders,
        body: JSON.stringify(projectionRequest),
      })
      const parts = await readParts(response, 'v2')
      expect(parts.some((part) => part.type === 'error')).toBe(true)
      expect(model.doStreamCalls).toHaveLength(1)
      expect(redirectTargetCalls).toBe(0)
    } finally {
      if ('closeAllConnections' in server) server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test.each([
    'v1',
    'v2',
  ] as const)('preserves %s execution wire and skips projection without policy', async (version) => {
    let calls = 0
    let received: unknown
    const host = new Hono()
    host.post('/v2/tools/execute', async (c) => {
      received = await c.req.json()
      return c.json(
        version === 'v2' ? { output: { raw: true } } : { raw: true }
      )
    })
    const server = serve({ fetch: host.fetch, port: 0, hostname: '127.0.0.1' })
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: ++calls === 1 ? atomicCall('a') : mockStream(),
      }),
    })
    const projector = vi.fn()
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      toolProjector: projector,
      mcpExecutionUrl: `http://127.0.0.1:${address.port}/v2/tools/execute`,
    })
    try {
      const { stepPolicy: _stepPolicy, ...withoutPolicy } = projectionRequest
      const response = await app.request(`/${version}/chat`, {
        method: 'POST',
        headers: projectionHeaders,
        body: JSON.stringify({
          ...withoutPolicy,
          contractVersion: version,
          generation:
            version === 'v1'
              ? conformanceRequest.generation
              : withoutPolicy.generation,
          messages: [conformanceRequest.messages[0]],
        }),
      })
      await readParts(response, version)
      expect(received).toEqual({
        serverId: 'doc-server',
        toolName: 'doc_query',
        input: { query: 'a' },
        ...(version === 'v2' ? { contractVersion: 'v2', toolCallId: 'a' } : {}),
      })
      expect(projector).not.toHaveBeenCalled()
      expect(model.doStreamCalls).toHaveLength(2)
    } finally {
      if ('closeAllConnections' in server) server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test.each([
    'timeout',
    'cancel',
  ] as const)('aborts projection on %s before another model call', async (mode) => {
    let calls = 0
    let projectionStarted!: () => void
    const started = new Promise<void>((resolve) => {
      projectionStarted = resolve
    })
    let projectionSignal: AbortSignal | undefined
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: ++calls === 1 ? atomicCall('a') : mockStream(),
      }),
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      toolExecutor: async () => ({ output: { raw: true } }),
      toolProjector: async ({ abortSignal }) => {
        projectionSignal = abortSignal
        projectionStarted()
        return await new Promise(() => undefined)
      },
    })
    const controller = new AbortController()
    const response = await app.request('/v2/chat', {
      method: 'POST',
      headers: projectionHeaders,
      body: JSON.stringify(projectionRequest),
      signal: controller.signal,
    })
    const partsPromise = readParts(response, 'v2')
    await started
    if (mode === 'cancel') controller.abort()
    const parts = await partsPromise
    expect(projectionSignal?.aborted).toBe(true)
    expect(model.doStreamCalls).toHaveLength(1)
    expect(
      parts.some(
        (part) =>
          part.type === 'message-metadata' &&
          part.messageMetadata.usage.inputTokens === 12
      )
    ).toBe(true)
    expect(
      parts.some((part) => part.type === 'error' || part.type === 'abort')
    ).toBe(true)
  }, 10_000)

  test.each([
    'timeout',
    'cancel',
  ] as const)('aborts a pending host projection over HTTP on %s', async (mode) => {
    let calls = 0
    let projectionStarted!: () => void
    let projectionClosed!: () => void
    const started = new Promise<void>((resolve) => {
      projectionStarted = resolve
    })
    const closed = new Promise<void>((resolve) => {
      projectionClosed = resolve
    })
    const server = createServer((request, response) => {
      request.resume()
      response.on('close', projectionClosed)
      projectionStarted()
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: ++calls === 1 ? atomicCall('a') : mockStream(),
      }),
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      mcpExecutionUrl: `http://127.0.0.1:${address.port}/v2/tools/execute`,
      toolExecutor: async () => ({ output: { raw: true } }),
    })
    const controller = new AbortController()
    try {
      const response = await app.request('/v2/chat', {
        method: 'POST',
        headers: projectionHeaders,
        body: JSON.stringify(projectionRequest),
        signal: controller.signal,
      })
      const partsPromise = readParts(response, 'v2')
      await started
      if (mode === 'cancel') controller.abort()
      const parts = await partsPromise
      await closed
      expect(model.doStreamCalls).toHaveLength(1)
      expect(
        parts.some(
          (part) =>
            part.type === 'message-metadata' &&
            part.messageMetadata.usage.inputTokens === 12
        )
      ).toBe(true)
      expect(
        parts.some((part) => part.type === 'error' || part.type === 'abort')
      ).toBe(true)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 10_000)

  test('fails closed when a streamed call ID is reused for a later result', async () => {
    let calls = 0
    const projector = vi.fn(
      async ({ toolCallIds }: { toolCallIds: string[] }) =>
        projectedOutputs(toolCallIds)
    )
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream:
          ++calls === 1
            ? atomicCall('a')
            : calls === 2
              ? atomicCall('a')
              : mockStream(),
      }),
    })
    const app = createDefaultEngineApp({
      serviceToken: 'service-secret',
      modelFactory: () => model,
      toolExecutor: async () => ({ output: { raw: true } }),
      toolProjector: projector,
    })
    const response = await app.request('/v2/chat', {
      method: 'POST',
      headers: projectionHeaders,
      body: JSON.stringify(projectionRequest),
    })
    const parts = await readParts(response, 'v2')
    expect(projector).toHaveBeenCalledTimes(1)
    expect(model.doStreamCalls).toHaveLength(2)
    expect(parts.some((part) => part.type === 'error')).toBe(true)
  })
})

test('uses the deployment provider origin without a model factory', async () => {
  const request = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        [
          {
            id: 'response-1',
            object: 'chat.completion.chunk',
            created: 0,
            model: 'gpt-4.1-mini',
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: 'synthetic answer' },
                finish_reason: null,
              },
            ],
          },
          {
            id: 'response-1',
            object: 'chat.completion.chunk',
            created: 0,
            model: 'gpt-4.1-mini',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
          },
        ]
          .map((part) => `data: ${JSON.stringify(part)}\n\n`)
          .join('') + 'data: [DONE]\n\n',
        { headers: { 'content-type': 'text/event-stream' } }
      )
  )
  vi.stubEnv('OPENAI_BASE_URL', 'https://deployment.synthetic.invalid/v1')
  vi.stubGlobal('fetch', request)
  try {
    const app = createDefaultEngineApp({
      serviceToken: 'synthetic-service',
      deploymentApiKey: 'synthetic-provider',
    })
    const response = await app.request('/v1/chat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer synthetic-service',
        'content-type': 'application/json',
      },
      body: JSON.stringify(conformanceRequest),
    })
    expect(response.status).toBe(200)
    const parts = await readParts(response)
    expect(parts.at(-1)?.type).toBe('finish')
    expect(request).toHaveBeenCalledTimes(1)
    expect(String(request.mock.calls[0]![0])).toBe(
      'https://deployment.synthetic.invalid/v1/chat/completions'
    )
  } finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})
