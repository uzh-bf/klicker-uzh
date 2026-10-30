import { once } from 'node:events'
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
  parseEngineStreamPart,
  runChatEngineConformanceSuite,
} from '@klicker-uzh/chat-engine-contract'
import { MockLanguageModelV3, MockLanguageModelV4 } from 'ai/test'
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
