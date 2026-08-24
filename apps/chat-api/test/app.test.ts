import {
  CHAT_ENGINE_CONTRACT_VERSION,
  conformanceManifest,
  type EngineChatRequest,
} from '@klicker-uzh/chat-engine-contract'
import { describe, expect, test, vi } from 'vitest'
import { type ChatApiDependencies, createChatApiApp } from '../src/app.js'

const chatbot = {
  id: 'chatbot-1',
  courseId: 'course-1',
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
    contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    engineId: 'fake-engine',
    reason: null,
  }),
}

function engineSse(parts: unknown[]) {
  const body = parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join('')
  return new Response(`${body}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function baseDependencies(
  chat: (request: EngineChatRequest) => Response | Promise<Response>
): ChatApiDependencies {
  return {
    authenticate: vi.fn(async () => ({
      participantId: 'participant-1',
      courseId: 'course-1',
    })),
    getChatbot: vi.fn(async () => chatbot),
    checkDisclaimer: vi.fn(async () => ({ required: false, accepted: true })),
    getCredits: vi.fn(async () => ({ current: 0, total: 1 })),
    getThread: vi.fn(async () => ({ id: 'thread-1' })),
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
      creditsCharged: true,
    })),
    engine: {
      manifest: vi.fn(async () => ({
        ...conformanceManifest,
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
  test('rejects a missing persisted thread without invoking or writing', async () => {
    const engine = vi.fn(async () => engineSse([]))
    const dependencies = baseDependencies(engine)
    dependencies.getThread = vi.fn(async () => null)
    const app = createChatApiApp(dependencies)

    const response = await app.request('/api/chatbots/chatbot-1/chat', {
      method: 'POST',
      headers: { cookie: 'participant_token=test' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'THREAD_REQUIRED' })
    expect(engine).not.toHaveBeenCalled()
    expect(dependencies.persistUserMessage).not.toHaveBeenCalled()
  })

  test('selects the fallback model at zero credits and traces one engine request', async () => {
    const captured: { value: EngineChatRequest | null } = { value: null }
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
            contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-4.1-mini',
            deploymentId: 'gpt-4.1-mini',
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
      headers: { cookie: 'participant_token=test' },
      body: JSON.stringify(body),
    })
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(captured.value?.generation.modelId).toBe('gpt-4.1-mini')
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
    expect(text).toContain('"creditsUsed":0.0000176')
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
            contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-4.1-mini',
            deploymentId: 'gpt-4.1-mini',
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
      headers: { cookie: 'participant_token=test' },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    const finalize = vi.mocked(dependencies.finalizeAssistantTurn)

    expect(response.status).toBe(200)
    expect(text).toContain('client cancelled')
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(finalize.mock.calls[0]?.[0]).toMatchObject({
      content: [{ type: 'text', text: 'Partial' }],
      creditsUsed: 0.0000088,
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
            contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-4.1-mini',
            deploymentId: 'gpt-4.1-mini',
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
      headers: { cookie: 'participant_token=test' },
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
        headers: { cookie: 'participant_token=test' },
        body: JSON.stringify(body),
      }
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'ENGINE_REQUEST_FAILED',
    })
    expect(dependencies.engine.chat).toHaveBeenCalledTimes(1)
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
        headers: { cookie: 'participant_token=test' },
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
            contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-4.1-mini',
            deploymentId: 'gpt-4.1-mini',
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
      headers: { cookie: 'participant_token=test' },
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
      headers: { cookie: 'participant_token=test' },
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
        headers: { cookie: 'participant_token=test' },
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
            contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
            engineId: 'fake-engine',
            runId: request.runId,
            modelId: 'gpt-4.1-mini',
            deploymentId: 'gpt-4.1-mini',
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
        headers: { cookie: 'participant_token=test' },
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
