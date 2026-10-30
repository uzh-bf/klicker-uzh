import {
  CHAT_ENGINE_CONTRACT_V2,
  conformanceV2Manifest,
  type EngineV2ChatRequest,
} from '@klicker-uzh/chat-engine-contract'
import { prisma } from '@klicker-uzh/prisma'
import { jsonSchema, tool } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import { type ChatApiDependencies, createChatApiApp } from '../src/app.js'
import { RequiredMCPUnavailableError } from '../src/host/lib/server/mcpRuntimePolicy.js'
import { selectReplyContext } from '../src/policy/modelRegistry.js'

const chatbot = {
  id: 'chatbot-1',
  courseId: 'course-1',
  ownerId: 'owner-1',
  owner: {
    aiFeaturesEnabled: true,
    aiSubscriptionTier: 'ADVANCED' as const,
    aiChatbotCostCenter: 'synthetic-cost-center',
  },
  course: { displayName: 'Synthetic course' },
  standardModeConfig: null,
  answerPreferencesEnabled: true,
  mcpConfigurations: [],
  systemPrompts: null,
  modelSelection: true,
  allowedModelIds: [],
  allowedReasoningEffortsByModel: null,
  openaiApiKey: null,
  openaiBaseUrl: null,
  disclaimerId: null,
}

const ready = {
  get: async () => ({
    ok: true,
    contractVersion: CHAT_ENGINE_CONTRACT_V2,
    engineId: 'fake-engine',
    reason: null,
    features: conformanceV2Manifest.features,
  }),
}

function engineSse(parts: unknown[]) {
  const body = parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join('')
  return new Response(`${body}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function baseDependencies(
  chat: (request: EngineV2ChatRequest) => Response | Promise<Response>
): ChatApiDependencies {
  return {
    getMeetingClockStart: vi.fn(async () => null),
    prepareAttachmentContext: vi.fn(async (input) => ({
      images: input.images,
      documentPageSummary: null,
      creditsUsed: 0,
    })),
    prepareTools: vi.fn(async () => ({
      tools: {},
      promptToolNames: [],
      promptContext: '',
      close: async () => undefined,
    })),
    claimChatTurn: vi.fn(async () => ({
      outcome: 'claimed' as const,
      lifecycleAttemptId: null,
    })),
    failChatTurn: vi.fn(async () => undefined),
    isChatAccountUsageAvailable: vi.fn(async () => true),
    authenticate: vi.fn(async () => ({
      participantId: 'participant-1',
      courseId: 'course-1',
    })),
    getChatbot: vi.fn(async () => chatbot),
    checkDisclaimer: vi.fn(async () => ({ required: false, accepted: true })),
    previewCredits: vi.fn(async () => ({ current: 0, total: 1 })),
    getCredits: vi.fn(async () => ({ current: 0, total: 1 })),
    getThread: vi.fn(async () => ({ id: 'thread-1' })),
    loadTurnContext: vi.fn(async () => ({ prompt: '', learningContext: null })),
    loadEngineMessages: vi.fn(async () => [
      {
        id: 'user-1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Question' }],
      },
    ]),
    persistUserMessage: vi.fn(async () => undefined),
    finalizeAssistantTurn: vi.fn(async () => ({
      persisted: true,
    })),
    engine: {
      manifest: vi.fn(async () => ({
        ...conformanceV2Manifest,
        engineId: 'fake-engine',
      })),
      chat: vi.fn(async (request) => chat(request)),
    },
    readiness: ready,
  }
}

const body = {
  messages: [{ id: 'user-1', role: 'user', content: 'Question' }],
  threadId: 'thread-1',
  selectedModel: 'gpt-4.1',
  selectedMode: 'tutor',
  reasoningEffort: 'none',
  assistantMessageId: 'assistant-1',
}

describe('chat-api Slice 2 tracer', () => {
  test.each([
    ['de-CH;q=0.8,en;q=0.5', 'de-CH'],
    ['*', 'en'],
    ['zh-Hant-TW-x-private;q=0.9', 'en'],
  ])('normalizes language header %s', async (header, locale) => {
    const dependencies = baseDependencies(async () => engineSse([]))
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      {
        method: 'POST',
        headers: { 'accept-language': header, origin: 'http://localhost' },
        body: JSON.stringify(body),
      }
    )
    expect(response.status).toBe(200)
    expect(vi.mocked(dependencies.engine.chat).mock.calls[0]?.[0].locale).toBe(
      locale
    )
    await response.body?.cancel()
  })

  test('preserves an explicit locale over the language header', async () => {
    const dependencies = baseDependencies(async () => engineSse([]))
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      {
        method: 'POST',
        headers: { 'accept-language': '*', origin: 'http://localhost' },
        body: JSON.stringify({ ...body, locale: 'fr-CH' }),
      }
    )
    expect(response.status).toBe(200)
    expect(vi.mocked(dependencies.engine.chat).mock.calls[0]?.[0].locale).toBe(
      'fr-CH'
    )
    await response.body?.cancel()
  })

  test('retains one admitted question per attempt when the engine fails and a participant retries', async () => {
    let accepted = false
    const dependencies = baseDependencies(async () => {
      if (!accepted) throw new Error('engine unavailable')
      return engineSse([])
    })
    const app = createChatApiApp(dependencies)
    const failed = await app.request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { origin: 'http://localhost' },
      body: JSON.stringify(body),
    })
    expect(failed.status).toBe(503)
    expect(dependencies.persistUserMessage).toHaveBeenCalledTimes(1)
    accepted = true
    const retry = await app.request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { origin: 'http://localhost' },
      body: JSON.stringify({
        ...body,
        messages: [{ id: 'user-retry', role: 'user', content: 'Question' }],
      }),
    })
    expect(retry.status).toBe(200)
    expect(dependencies.persistUserMessage).toHaveBeenCalledTimes(2)
    expect(dependencies.persistUserMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ messageId: 'user-retry' })
    )
    await retry.body?.cancel()
  })

  test('fails the admitted claim before generation when question persistence fails', async () => {
    const cancel = vi.fn()
    const upstream = new Response(new ReadableStream({ cancel }), {
      headers: { 'content-type': 'text/event-stream' },
    })
    const dependencies = baseDependencies(async () => upstream)
    dependencies.persistUserMessage = vi.fn(async () => {
      throw new Error('database unavailable')
    })
    const signals: AbortSignal[] = []
    dependencies.engine.chat = vi.fn(async (_, options) => {
      signals.push(options.signal)
      return upstream
    })
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      {
        method: 'POST',
        headers: { origin: 'http://localhost' },
        body: JSON.stringify(body),
      }
    )
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      code: 'MESSAGE_PERSISTENCE_FAILED',
    })
    expect(signals).toHaveLength(0)
    expect(dependencies.engine.chat).not.toHaveBeenCalled()
    expect(dependencies.failChatTurn).toHaveBeenCalledTimes(1)
    expect(cancel).not.toHaveBeenCalled()
    expect(dependencies.finalizeAssistantTurn).not.toHaveBeenCalled()
  })

  test('rejects a missing persisted thread without invoking or writing', async () => {
    const engine = vi.fn(async () => engineSse([]))
    const dependencies = baseDependencies(engine)
    dependencies.getThread = vi.fn(async () => null)
    const app = createChatApiApp(dependencies)

    const response = await app.request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { cookie: 'participant_token=test', origin: 'http://localhost' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'THREAD_REQUIRED' })
    expect(engine).not.toHaveBeenCalled()
    expect(dependencies.persistUserMessage).not.toHaveBeenCalled()
  })

  test('selects the fallback model at zero credits and traces one engine request', async () => {
    const captured: { value: EngineV2ChatRequest | null } = { value: null }
    const dependencies = baseDependencies(async (request) => {
      captured.value = request
      return engineSse([
        { type: 'start', messageId: 'assistant-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Answer' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: {
            contractVersion: CHAT_ENGINE_CONTRACT_V2,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-6-luna',
            deploymentId: 'gpt-6-luna',
            usage: {
              inputTokens: 12,
              outputTokens: 8,
              reasoningTokens: null,
              cacheReadTokens: null,
              cacheWriteTokens: null,
              totalTokens: 20,
            },
            reasoningContent: null,
            aborted: false,
          },
        },
      ])
    })
    const app = createChatApiApp(dependencies)
    const response = await app.request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { cookie: 'participant_token=test', origin: 'http://localhost' },
      body: JSON.stringify(body),
    })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(captured.value?.generation.modelId).toBe('gpt-6-luna')
    expect(captured.value?.generation.credentialMode.mode).toBe('deployment')
    expect(captured.value).not.toHaveProperty('traceContext')
    expect(dependencies.engine.chat).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        traceContext: {
          traceparent: expect.stringMatching(
            /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/
          ),
        },
      })
    )
    expect(text).toContain('"type":"finish"')
    expect(text).toContain('"creditsUsed":0.0000052')
    expect(dependencies.engine.chat).toHaveBeenCalledTimes(1)
    expect(dependencies.finalizeAssistantTurn).toHaveBeenCalledTimes(1)
  })

  test('persists a partial abort and charges validated usage once', async () => {
    const dependencies = baseDependencies(async (request) =>
      engineSse([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Partial' },
        {
          type: 'message-metadata',
          messageMetadata: {
            contractVersion: CHAT_ENGINE_CONTRACT_V2,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-6-luna',
            deploymentId: 'gpt-6-luna',
            usage: {
              inputTokens: 10,
              outputTokens: 3,
              reasoningTokens: null,
              cacheReadTokens: null,
              cacheWriteTokens: null,
              totalTokens: 13,
            },
            reasoningContent: null,
            aborted: true,
          },
        },
        { type: 'abort', reason: 'client cancelled' },
      ])
    )
    const app = createChatApiApp(dependencies)
    const response = await app.request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { cookie: 'participant_token=test', origin: 'http://localhost' },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    const finalize = vi.mocked(dependencies.finalizeAssistantTurn)

    expect(response.status).toBe(200)
    expect(text).toContain('client cancelled')
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(finalize.mock.calls[0]?.[0]).toMatchObject({
      content: [
        { type: 'text', text: 'Partial' },
        { type: 'data', name: 'chat-stopped', data: {} },
      ],
      creditsUsed: 0.0000025,
    })
  })

  test('fails closed on missing usage and does not invent a charge', async () => {
    const dependencies = baseDependencies(async (request) =>
      engineSse([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Unpriced' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: {
            contractVersion: CHAT_ENGINE_CONTRACT_V2,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-6-luna',
            deploymentId: 'gpt-6-luna',
            usage: {
              inputTokens: null,
              outputTokens: 4,
              reasoningTokens: null,
              cacheReadTokens: null,
              cacheWriteTokens: null,
              totalTokens: null,
            },
            reasoningContent: null,
            aborted: false,
          },
        },
      ])
    )
    const app = createChatApiApp(dependencies)
    const response = await app.request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { cookie: 'participant_token=test', origin: 'http://localhost' },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    const finalize = vi.mocked(dependencies.finalizeAssistantTurn)

    expect(response.status).toBe(200)
    expect(text).toContain('INVALID_ENGINE_USAGE')
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(finalize.mock.calls[0]?.[0].creditsUsed).toBeNull()
  })

  test('does not retry or switch engines after an engine request failure', async () => {
    const dependencies = baseDependencies(async () => {
      throw new Error('engine unavailable')
    })
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      {
        method: 'POST',
        headers: {
          cookie: 'participant_token=test',
          origin: 'http://localhost',
        },
        body: JSON.stringify(body),
      }
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'ENGINE_REQUEST_FAILED',
    })
    expect(dependencies.engine.chat).toHaveBeenCalledTimes(1)
    expect(dependencies.persistUserMessage).toHaveBeenCalledTimes(1)
    expect(dependencies.failChatTurn).toHaveBeenCalledTimes(1)
    expect(dependencies.finalizeAssistantTurn).not.toHaveBeenCalled()
  })

  test('does not send the deployment credential to an unkeyed custom base URL', async () => {
    const dependencies = baseDependencies(async () => engineSse([]))
    dependencies.getChatbot = vi.fn(async () => ({
      ...chatbot,
      openaiBaseUrl: 'https://untrusted.example/v1',
    }))
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      {
        method: 'POST',
        headers: {
          cookie: 'participant_token=test',
          origin: 'http://localhost',
        },
        body: JSON.stringify(body),
      }
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    })
    expect(dependencies.engine.chat).not.toHaveBeenCalled()
  })

  test('sends a request credential only to an explicitly allowed provider origin', async () => {
    const dependencies = baseDependencies(async (request) =>
      engineSse([
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: {
            contractVersion: CHAT_ENGINE_CONTRACT_V2,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-6-luna',
            deploymentId: 'gpt-6-luna',
            usage: {
              inputTokens: 12,
              outputTokens: 8,
              reasoningTokens: null,
              cacheReadTokens: null,
              cacheWriteTokens: null,
              totalTokens: 20,
            },
            reasoningContent: null,
            aborted: false,
          },
        },
      ])
    )
    dependencies.getChatbot = vi.fn(async () => ({
      ...chatbot,
      openaiApiKey: 'request-key',
      openaiBaseUrl: 'https://provider.example.test/v1',
    }))

    const response = await createChatApiApp(dependencies, {
      providerAllowedOrigins: new Set(['https://provider.example.test']),
    }).request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { cookie: 'participant_token=test', origin: 'http://localhost' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(200)
    expect(dependencies.engine.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        generation: expect.objectContaining({
          credentialMode: {
            mode: 'gateway',
            gatewayOrigin: 'https://provider.example.test/v1',
          },
        }),
      }),
      expect.objectContaining({
        providerAuthorization: 'Bearer request-key',
      })
    )
  })

  test('rejects a request credential for an unlisted provider origin', async () => {
    const dependencies = baseDependencies(async () => engineSse([]))
    dependencies.getChatbot = vi.fn(async () => ({
      ...chatbot,
      openaiApiKey: 'request-key',
      openaiBaseUrl: 'https://untrusted.example.test/v1',
    }))

    const response = await createChatApiApp(dependencies, {
      providerAllowedOrigins: new Set(['https://provider.example.test']),
    }).request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { cookie: 'participant_token=test', origin: 'http://localhost' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    })
    expect(dependencies.engine.chat).not.toHaveBeenCalled()
  })

  test('requires tools and their execution token to be resolved together', async () => {
    const dependencies = baseDependencies(async () => engineSse([]))
    dependencies.authorizeTools = vi.fn(async () => ({
      tools: [
        {
          name: 'doc_query',
          inputSchema: { type: 'object' },
          serverId: 'doc-server',
        },
      ],
      executionToken: '',
    }))

    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      {
        method: 'POST',
        headers: {
          cookie: 'participant_token=test',
          origin: 'http://localhost',
        },
        body: JSON.stringify(body),
      }
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'MCP_EXECUTION_NOT_CONFIGURED',
    })
    expect(dependencies.engine.chat).not.toHaveBeenCalled()
  })

  test('forwards an approved tool only with its matching execution token', async () => {
    const dependencies = baseDependencies(async (request) =>
      engineSse([
        {
          type: 'finish',
          finishReason: 'stop',
          messageMetadata: {
            contractVersion: CHAT_ENGINE_CONTRACT_V2,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-6-luna',
            deploymentId: 'gpt-6-luna',
            usage: {
              inputTokens: 12,
              outputTokens: 8,
              reasoningTokens: null,
              cacheReadTokens: null,
              cacheWriteTokens: null,
              totalTokens: 20,
            },
            reasoningContent: null,
            aborted: false,
          },
        },
      ])
    )
    dependencies.authorizeTools = vi.fn(async () => ({
      tools: [
        {
          name: 'doc_query',
          inputSchema: { type: 'object' },
          serverId: 'doc-server',
        },
      ],
      executionToken: 'scoped-token',
    }))

    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      {
        method: 'POST',
        headers: {
          cookie: 'participant_token=test',
          origin: 'http://localhost',
        },
        body: JSON.stringify(body),
      }
    )

    expect(response.status).toBe(200)
    expect(dependencies.engine.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [expect.objectContaining({ name: 'doc_query' })],
      }),
      expect.objectContaining({ mcpExecutionToken: 'scoped-token' })
    )
  })
})

const request = (data: unknown = body, origin = 'http://localhost') => ({
  method: 'POST',
  headers: { cookie: 'participant_token=test', origin },
  body: JSON.stringify(data),
})

describe('current host admission and turn lifecycle', () => {
  test.each([
    { documentPages: ['synthetic-page'] },
    { handoffSource: 'synthetic-source' },
  ])('rejects unsupported input before claiming or execution: %j', async (extra) => {
    const dependencies = baseDependencies(async () => engineSse([]))
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      request({ ...body, ...extra })
    )
    expect(response.status).toBe(400)
    expect(dependencies.claimChatTurn).not.toHaveBeenCalled()
    expect(dependencies.engine.chat).not.toHaveBeenCalled()
  })
  test('rejects forged origins before authentication or database work', async () => {
    const dependencies = baseDependencies(async () => engineSse([]))
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      request(body, 'https://other.example.invalid')
    )
    expect(response.status).toBe(403)
    expect(dependencies.authenticate).not.toHaveBeenCalled()
  })
  test('does not execute a completed or concurrent turn again', async () => {
    for (const outcome of ['completed', 'in_progress'] as const) {
      const dependencies = baseDependencies(async () => engineSse([]))
      dependencies.claimChatTurn = vi.fn(async () => ({
        outcome,
        lifecycleAttemptId: null,
      }))
      const response = await createChatApiApp(dependencies).request(
        '/api/chatbots/chatbot-1/chat',
        request()
      )
      expect(response.status).toBe(409)
      expect(dependencies.persistUserMessage).not.toHaveBeenCalled()
      expect(dependencies.engine.chat).not.toHaveBeenCalled()
      expect(dependencies.prepareTools).not.toHaveBeenCalled()
      expect(dependencies.prepareAttachmentContext).not.toHaveBeenCalled()
      expect(dependencies.finalizeAssistantTurn).not.toHaveBeenCalled()
    }
  })
  test('marks an admitted claim failed when the engine fails before streaming', async () => {
    const dependencies = baseDependencies(async () => {
      throw new Error('synthetic failure')
    })
    await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      request({ ...body, allowRegeneration: true })
    )
    expect(dependencies.claimChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ allowRegeneration: true, parentId: 'user-1' })
    )
    expect(dependencies.failChatTurn).toHaveBeenCalledTimes(1)
  })
  test('keeps a required course-tool outage closed before generation', async () => {
    const dependencies = baseDependencies(async () => engineSse([]))
    dependencies.prepareTools = vi.fn(async () => {
      throw new RequiredMCPUnavailableError()
    })
    dependencies.getChatbot = vi.fn(async () => ({
      ...chatbot,
      mcpConfigurations: [
        { chatMode: 'tutor', isEnabled: true, parameters: { required: true } },
      ],
    }))
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/chat',
      request()
    )
    expect(response.status).toBe(503)
    expect(dependencies.claimChatTurn).toHaveBeenCalledTimes(1)
    expect(dependencies.failChatTurn).toHaveBeenCalledTimes(1)
    expect(dependencies.engine.chat).not.toHaveBeenCalled()
  })
})

test('normalizes wildcard browser language headers to a valid locale before admission', async () => {
  const dependencies = baseDependencies(async () => engineSse([]))
  const response = await createChatApiApp(dependencies).request(
    '/api/chatbots/chatbot-1/chat',
    {
      method: 'POST',
      headers: {
        cookie: 'participant_token=test',
        origin: 'http://localhost',
        'accept-language': '*',
      },
      body: JSON.stringify(body),
    }
  )
  expect(response.status).toBe(200)
  expect(dependencies.engine.chat).toHaveBeenCalledWith(
    expect.objectContaining({ locale: 'en' }),
    expect.anything()
  )
})

test('preserves credentialed CORS on the streaming response', async () => {
  const dependencies = baseDependencies(async () => engineSse([]))
  const origin = 'https://chat.synthetic.invalid'
  const app = createChatApiApp(dependencies, {
    browserAllowedOrigins: new Set([origin]),
  })
  const response = await app.request('/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: {
      cookie: 'participant_token=test',
      origin,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('access-control-allow-origin')).toBe(origin)
  expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  await response.text()
})

test('forwards all participant transports and rejects denied authentication before generation', async () => {
  const dependencies = baseDependencies(async () => engineSse([]))
  dependencies.authenticate = vi.fn(async () => ({
    error: 'Invalid authentication token',
    status: 401 as const,
  }))
  const app = createChatApiApp(dependencies)
  const response = await app.request('/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      cookie:
        'participant_token=account; chat_participant_token=guest; chat_pwa_embed_token=embed',
      authorization: 'Bearer scoped',
    },
    body: JSON.stringify(body),
  })
  expect(response.status).toBe(401)
  expect(dependencies.authenticate).toHaveBeenCalledWith(
    {
      participantToken: 'account',
      chatGuestToken: 'guest',
      pwaEmbedToken: 'embed',
      scopedFallbackToken: 'scoped',
    },
    'chatbot-1'
  )
  expect(dependencies.getChatbot).not.toHaveBeenCalled()
  expect(dependencies.claimChatTurn).not.toHaveBeenCalled()
  expect(dependencies.engine.chat).not.toHaveBeenCalled()
  const preflight = await app.request('/api/chatbots/chatbot-1/chat', {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost',
      'access-control-request-headers': 'authorization',
    },
  })
  expect(preflight.status).toBe(204)
  expect(
    preflight.headers
      .get('access-control-allow-headers')
      ?.toLowerCase()
      .split(/,\s*/)
  ).toContain('authorization')
})

test.each([
  99, 100, 101,
])('bounds model context while admitting a saved branch of %s messages', async (count) => {
  const dependencies = baseDependencies(async () => engineSse([]))
  const messages = Array.from({ length: count }, (_, index) => ({
    id: `message-${index}`,
    role: (index === count - 1 || index % 2 === 0 ? 'user' : 'assistant') as
      | 'user'
      | 'assistant',
    content: 'synthetic',
  }))
  dependencies.loadEngineMessages = vi.fn(async () =>
    messages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: 'text' as const, text: message.content }],
    }))
  )
  const response = await createChatApiApp(dependencies).request(
    '/api/chatbots/chatbot-1/chat',
    request({ ...body, messages })
  )
  expect(response.status).toBe(200)
  const submitted = vi.mocked(dependencies.engine.chat).mock.calls[0]?.[0]
  expect(submitted?.messages.length).toBeLessThanOrEqual(100)
  expect(submitted?.messages.at(-1)?.id).toBe(messages.at(-1)?.id)
  expect(messages).toHaveLength(count)
  await response.body?.cancel()
})

test('admits full document text with three originals and ten transient pages in v2', async () => {
  const dependencies = baseDependencies(async () => engineSse([]))
  const first = 'x'.repeat(120_000)
  const second = 'y'.repeat(120_000)
  const originals = Array.from({ length: 3 }, (_, index) => ({
    id: `image-${index}`,
    type: 'image' as const,
    source: 'attachment' as const,
    mediaType: 'image/png' as const,
    dataUrl: 'data:image/png;base64,AQ==',
  }))
  const pages = Array.from({ length: 10 }, () => 'data:image/jpeg;base64,AQ==')
  dependencies.loadEngineMessages = vi.fn(async () => [
    {
      id: 'user-1',
      role: 'user' as const,
      parts: [
        { type: 'text' as const, text: first },
        { type: 'text' as const, text: second },
        ...originals,
      ],
    },
  ])
  const response = await createChatApiApp(dependencies).request(
    '/api/chatbots/chatbot-1/chat',
    request({
      ...body,
      messages: [{ id: 'user-1', role: 'user', content: first + second }],
      images: originals.map((image) => image.dataUrl),
      documentPages: pages,
    })
  )
  expect(response.status).toBe(200)
  const submitted = vi.mocked(dependencies.engine.chat).mock.calls[0]?.[0]
  expect(submitted?.contractVersion).toBe('v2')
  const parts = submitted?.messages.at(-1)?.parts ?? []
  expect(
    parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
  ).toBe(first + second)
  expect(
    parts.filter((part) => part.type === 'image').map((part) => part.dataUrl)
  ).toEqual([...originals.map((image) => image.dataUrl), ...pages])
  expect(
    vi.mocked(dependencies.persistUserMessage).mock.calls[0]?.[0].attachments
  ).toHaveLength(3)
  await response.body?.cancel()
})

test('trims whole old exchanges and refuses a current turn that cannot fit its model budget', () => {
  const messages = [
    {
      id: 'user-old',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'x'.repeat(4000) }],
    },
    {
      id: 'assistant-old',
      role: 'assistant' as const,
      parts: [
        {
          type: 'tool-call' as const,
          toolCallId: 'call-old',
          toolName: 'search',
          input: {},
          output: {},
        },
      ],
    },
    {
      id: 'user-current',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'synthetic' }],
    },
  ]
  const options = {
    maxInputTokens: 100,
    systemPrompt: 'system',
    tools: [],
    maxOutputTokens: 10,
  }
  const context = selectReplyContext(messages, options)
  expect(context?.messages.map((message) => message.id)).toEqual([
    'user-current',
  ])
  expect(context?.omittedMessages).toBe(2)
  expect(messages).toHaveLength(3)
  expect(selectReplyContext([messages[0]!], options)).toBeNull()
})

test('persists the question before auxiliary generation and settles known costs when it stops', async () => {
  const dependencies = baseDependencies(async () => engineSse([]))
  dependencies.prepareAttachmentContext = vi.fn(async (input) => {
    expect(dependencies.persistUserMessage).toHaveBeenCalledTimes(1)
    return {
      images: input.images,
      documentPageSummary: null,
      creditsUsed: 0.03,
      aborted: true,
    }
  })
  const response = await createChatApiApp(dependencies).request(
    '/api/chatbots/chatbot-1/chat',
    request({ ...body, images: ['data:image/png;base64,AQ=='] })
  )
  expect(response.status).toBe(503)
  expect(dependencies.engine.chat).not.toHaveBeenCalled()
  expect(dependencies.finalizeAssistantTurn).toHaveBeenCalledOnce()
  expect(
    vi.mocked(dependencies.finalizeAssistantTurn).mock.calls[0]?.[0]
  ).toMatchObject({
    creditsUsed: 0.03,
    content: [{ type: 'data', name: 'chat-stopped', data: {} }],
  })
  expect(dependencies.failChatTurn).not.toHaveBeenCalled()
})

test('starts no auxiliary work when saving the admitted question fails', async () => {
  const dependencies = baseDependencies(async () => engineSse([]))
  dependencies.persistUserMessage = vi.fn(async () => {
    throw new Error('synthetic persistence failure')
  })
  const response = await createChatApiApp(dependencies).request(
    '/api/chatbots/chatbot-1/chat',
    request({ ...body, images: ['data:image/png;base64,AQ=='] })
  )
  expect(response.status).toBe(500)
  expect(dependencies.prepareAttachmentContext).not.toHaveBeenCalled()
  expect(dependencies.engine.chat).not.toHaveBeenCalled()
  expect(dependencies.failChatTurn).toHaveBeenCalledOnce()
})

test.each([
  ['gpt-4.1', 'chat'],
  ['auto', 'responses'],
])('preserves model-selected transport for %s without reasoning', async (selectedModel, providerApi) => {
  const dependencies = baseDependencies(async () => engineSse([]))
  dependencies.previewCredits = vi.fn(async () => ({
    current: 100,
    total: 100,
  }))
  dependencies.getCredits = vi.fn(async () => ({ current: 100, total: 100 }))
  const response = await createChatApiApp(dependencies).request(
    '/api/chatbots/chatbot-1/chat',
    request({ ...body, selectedModel })
  )
  expect(response.status).toBe(200)
  expect(
    vi.mocked(dependencies.engine.chat).mock.calls[0]?.[0].generation
  ).toMatchObject({ providerApi, reasoningEffort: 'none' })
  await response.body?.cancel()
})

test.each([
  'tutor',
  'cm_clock_fixture',
])('preserves step retrieval policy and custom clocks for %s', async (selectedMode) => {
  const dependencies = baseDependencies(async (engineRequest) =>
    engineSse([{ type: 'start', messageId: engineRequest.assistantMessageId }])
  )
  const mode = {
    key: 'cm_clock_fixture',
    name: 'Synthetic',
    personaText: 'test-persona-1',
    showReasoning: false,
    replyLanguage: 'de',
    meetingClock: 'ELAPSED_AND_TIME',
  }
  dependencies.getChatbot = vi.fn(async () => ({
    ...chatbot,
    customModeConfig: { modes: [mode] },
  }))
  dependencies.getMeetingClockStart = vi.fn(
    async () => new Date('2026-01-01T00:00:00Z')
  )
  dependencies.prepareTools = vi.fn(async () => ({
    tools: {
      doc_query: tool({
        inputSchema: jsonSchema({ type: 'object' }),
        execute: async () => ({}),
      }),
    },
    promptToolNames: ['doc_query'],
    promptContext: '',
    close: async () => undefined,
  }))
  const response = await createChatApiApp(dependencies).request(
    '/api/chatbots/chatbot-1/chat',
    request({ ...body, selectedMode })
  )
  expect(response.status).toBe(200)
  const sent = vi.mocked(dependencies.engine.chat).mock.calls[0]?.[0]
  if (sent?.contractVersion !== 'v2')
    throw new Error('Expected explicit v2 request')
  expect(sent.stepPolicy?.firstToolName).toBe(
    selectedMode === 'tutor' ? 'doc_query' : undefined
  )
  const events = (await response.text())
    .split('\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice(6)))
  const start = events.find((event) => event.type === 'start')
  if (selectedMode === mode.key) {
    expect(dependencies.getMeetingClockStart).toHaveBeenCalledWith('thread-1')
    expect(start?.messageMetadata.meetingClockStartedAt).toBe(
      '2026-01-01T00:00:00.000Z'
    )
    expect(Number.isFinite(Date.parse(start?.messageMetadata.serverNow))).toBe(
      true
    )
  } else {
    expect(dependencies.getMeetingClockStart).not.toHaveBeenCalled()
  }
})

test('reloads only the participant message DTO and applies current reasoning visibility', async () => {
  const dependencies = baseDependencies(async () => engineSse([]))
  const now = new Date('2026-01-01T00:00:00Z')
  const learningContext = { kind: 'synthetic-context' }
  const findMany = vi
    .spyOn(prisma.chatMessage, 'findMany')
    .mockResolvedValueOnce([
      {
        id: 'assistant-1',
        threadId: 'thread-1',
        role: 'assistant',
        content: [
          { type: 'text', text: 'test-answer-1' },
          { type: 'reasoning', text: 'test-private-reasoning-1' },
        ],
        chatMode: 'cm_removed',
        modelId: 'gpt-4.1',
        reasoningEffort: 'low',
        reasoningContent: 'test-private-reasoning-1',
        learningContext,
        rating: null,
        creditsUsed: null,
        parentId: 'user-1',
        lifecycleStatus: 'COMPLETED',
        lifecycleAttemptId: 'internal-attempt-1',
        createdAt: now,
        updatedAt: now,
        attachments: [],
      },
    ] as never)
  try {
    const response = await createChatApiApp(dependencies).request(
      '/api/chatbots/chatbot-1/threads/thread-1/messages'
    )
    expect(response.status).toBe(200)
    const messages = (await response.json()) as Array<Record<string, unknown>>
    expect(messages[0]).toMatchObject({
      content: [{ type: 'text', text: 'test-answer-1' }],
      reasoningContent: null,
      learningContext,
      parentId: 'user-1',
    })
    expect(messages[0]).not.toHaveProperty('lifecycleAttemptId')
    expect(messages[0]).not.toHaveProperty('lifecycleStatus')
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: 'COMPLETED',
          thread: { participantId: 'participant-1', chatbotId: 'chatbot-1' },
        }),
        include: {
          attachments: {
            where: { imageBase64: { not: null } },
            orderBy: { position: 'asc' },
          },
        },
      })
    )
  } finally {
    findMany.mockRestore()
  }
})
