import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  checkDisclaimerStatus: vi.fn(),
  chatbotFindUnique: vi.fn(),
  threadFindFirst: vi.fn(),
  messageUpdateMany: vi.fn(),
  messageFindUnique: vi.fn(),
  messageCreate: vi.fn(),
  attachmentFindMany: vi.fn(),
  attachmentDeleteMany: vi.fn(),
  attachmentCreateMany: vi.fn(),
  threadUpdate: vi.fn(),
  transaction: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  createThread: vi.fn(),
  previewUserCredits: vi.fn(),
  getUserCredits: vi.fn(),
  decrementCredits: vi.fn(),
  isChatTurnKeyClaimed: vi.fn(),
  isChatAccountUsageAvailable: vi.fn(),
  finalizeChatTurn: vi.fn(),
  ensureImagePreviewBase64: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
  roundChatUsageCredits: vi.fn(),
  streamConfig: null as Record<string, unknown> | null,
  responseOptions: null as Record<string, unknown> | null,
  ChatTurnConflictError: class ChatTurnConflictError extends Error {},
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))

vi.mock('@/src/services/disclaimers', () => ({
  DisclaimersService: {
    checkDisclaimerStatus: mocks.checkDisclaimerStatus,
  },
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatbot: { findUnique: mocks.chatbotFindUnique },
    chatThread: {
      findFirst: mocks.threadFindFirst,
      update: mocks.threadUpdate,
    },
    chatMessage: {
      updateMany: mocks.messageUpdateMany,
      findUnique: mocks.messageFindUnique,
      create: mocks.messageCreate,
    },
    chatAttachment: {
      findMany: mocks.attachmentFindMany,
      deleteMany: mocks.attachmentDeleteMany,
      createMany: mocks.attachmentCreateMany,
    },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/src/services/mcpClients', () => ({
  getAggregatedMCPTools: mocks.getAggregatedMCPTools,
}))

vi.mock('@/src/services/threads', () => ({
  ThreadService: { createThread: mocks.createThread },
}))

vi.mock('@/src/services/credits', () => ({
  CreditsService: {
    previewUserCredits: mocks.previewUserCredits,
    getUserCredits: mocks.getUserCredits,
    decrementCredits: mocks.decrementCredits,
  },
}))

vi.mock('@/src/services/accountUsage', () => {
  return {
    CHAT_TURN_ALREADY_COMPLETED_CODE: 'CHAT_TURN_ALREADY_COMPLETED',
    ChatTurnConflictError: mocks.ChatTurnConflictError,
    finalizeChatTurn: mocks.finalizeChatTurn,
    isChatAccountUsageAvailable: mocks.isChatAccountUsageAvailable,
    isChatTurnKeyClaimed: mocks.isChatTurnKeyClaimed,
    roundChatUsageCredits: mocks.roundChatUsageCredits,
  }
})

vi.mock('@/src/lib/server/imagePreview', () => ({
  ensureImagePreviewBase64: mocks.ensureImagePreviewBase64,
}))

vi.mock('@/src/lib/server/promptCacheIdentity', () => ({
  buildPromptCacheRequest: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/src/lib/server/langfuseTracing', () => ({
  getParentSpanContext: vi.fn(),
  getTraceIdForMessage: vi.fn(),
  isAiTelemetryEnabled: false,
}))

vi.mock('@/src/lib/server/openaiCachePolicy', () => ({
  createOpenAIFetch: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({
    chat: (deploymentId: string) => ({ deploymentId }),
    responses: (deploymentId: string) => ({ deploymentId }),
  }),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateText: mocks.generateText,
    streamText: mocks.streamText,
  }
})

import { POST } from '../src/app/api/chatbots/[chatbotId]/chat/route'

type StreamCallbacks = {
  onEnd: (result: {
    usage: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    } | null
    steps: Array<{ content: unknown[] }>
    reasoningText?: string
    providerMetadata?: unknown
  }) => Promise<void>
  onAbort: (result: {
    steps: Array<{
      content: unknown[]
      usage?: { inputTokens: number; outputTokens: number }
    }>
  }) => Promise<void>
}

type ResponseOptions = {
  messageMetadata: (input: {
    part: {
      type: string
      finishReason?: string
      totalUsage?: {
        inputTokens: number
        outputTokens: number
      }
    }
  }) => unknown
}

function streamCallbacks(): StreamCallbacks {
  return mocks.streamConfig as unknown as StreamCallbacks
}

function responseOptions(): ResponseOptions {
  return mocks.responseOptions as unknown as ResponseOptions
}

function chatbot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chatbot-1',
    ownerId: 'owner-1',
    systemPrompts: { tutor: { prompt: 'Use course material.' } },
    mcpConfigurations: [],
    modelSelection: true,
    allowedModelIds: ['gpt-4.1', 'gpt-4.1-mini'],
    allowedReasoningEffortsByModel: null,
    openaiApiKey: null,
    openaiBaseUrl: null,
    ...overrides,
  }
}

function createRequest({
  selectedModel = 'gpt-4.1',
  assistantMessageId = 'assistant-1',
  images = [],
}: {
  selectedModel?: string
  assistantMessageId?: string
  images?: string[]
} = {}) {
  return new NextRequest('http://localhost/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ id: 'message-1', role: 'user', content: 'Explain this.' }],
      threadId: 'thread-1',
      selectedModel,
      selectedMode: 'tutor',
      assistantMessageId,
      images,
    }),
  })
}

describe('account usage chat route', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.streamConfig = null
    mocks.responseOptions = null
    mocks.withChatbotAuth.mockResolvedValue({ participantId: 'participant-1' })
    mocks.checkDisclaimerStatus.mockResolvedValue({
      required: false,
      accepted: true,
    })
    mocks.chatbotFindUnique.mockResolvedValue(chatbot())
    mocks.getAggregatedMCPTools.mockResolvedValue({})
    mocks.isChatTurnKeyClaimed.mockResolvedValue(false)
    mocks.isChatAccountUsageAvailable.mockResolvedValue(true)
    mocks.roundChatUsageCredits.mockImplementation((value: number) => ({
      toNumber: () => Number(value.toFixed(6)),
    }))
    mocks.previewUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.getUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.threadFindFirst.mockResolvedValue({ id: 'thread-1' })
    mocks.attachmentFindMany.mockResolvedValue([])
    mocks.messageUpdateMany.mockResolvedValue({ count: 0 })
    mocks.messageFindUnique.mockResolvedValue(null)
    mocks.messageCreate.mockResolvedValue({ id: 'message-1' })
    mocks.threadUpdate.mockResolvedValue({ id: 'thread-1' })
    mocks.transaction.mockResolvedValue([])
    mocks.finalizeChatTurn.mockImplementation(async (input) => ({
      outcome: 'created',
      creditsUsed:
        input.rawCreditsUsed === null
          ? null
          : Number(input.rawCreditsUsed.toFixed(6)),
    }))
    mocks.streamText.mockImplementation((config) => {
      mocks.streamConfig = config as Record<string, unknown>
      return {
        toUIMessageStreamResponse: (options: Record<string, unknown>) => {
          mocks.responseOptions = options
          return new Response('{}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        },
      }
    })
  })

  test('rejects a completed assistant key before MCP or provider work', async () => {
    mocks.isChatTurnKeyClaimed.mockResolvedValueOnce(true)

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat turn already completed',
      code: 'CHAT_TURN_ALREADY_COMPLETED',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.isChatAccountUsageAvailable).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('denies unavailable BASE usage before image, thread, or provider work', async () => {
    mocks.isChatAccountUsageAvailable.mockResolvedValueOnce(false)

    const response = await POST(
      createRequest({ images: ['data:image/png;base64,AAAA'] }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat model usage is unavailable',
      code: 'CHAT_MODEL_UNAVAILABLE_BASE',
    })
    expect(mocks.ensureImagePreviewBase64).not.toHaveBeenCalled()
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.threadFindFirst).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('denies zero-credit ADVANCED usage instead of crossing to BASE', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({
        allowedModelIds: ['gpt-5.6-luna', 'gpt-4.1-mini'],
      })
    )
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(
      createRequest({ selectedModel: 'gpt-5.6-luna' }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat model usage is unavailable',
      code: 'CHAT_MODEL_UNAVAILABLE_ADVANCED',
    })
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'ADVANCED',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.getUserCredits).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('keeps automatic zero-credit usage in its ADVANCED class', async () => {
    vi.stubEnv('CHAT_PRIMARY_MODEL_ID', 'auto')
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({
        modelSelection: false,
        allowedModelIds: ['auto', 'gpt-4.1-mini'],
      })
    )
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'CHAT_MODEL_UNAVAILABLE_ADVANCED',
    })
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'ADVANCED',
    })
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('does not use another class when the ADVANCED account budget is unavailable', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({
        allowedModelIds: ['gpt-5.6-luna', 'gpt-4.1-mini'],
      })
    )
    mocks.isChatAccountUsageAvailable.mockResolvedValueOnce(false)

    const response = await POST(
      createRequest({ selectedModel: 'gpt-5.6-luna' }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'CHAT_MODEL_UNAVAILABLE_ADVANCED',
    })
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('denies a same-class fallback omitted from the chatbot allow-list', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({ allowedModelIds: ['gpt-4.1'] })
    )
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'CHAT_MODEL_UNAVAILABLE_BASE',
    })
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('finalizes a same-class fallback once and returns the rounded amount', async () => {
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })
    mocks.getUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'BASE',
    })

    const result = {
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      steps: [{ content: [{ type: 'text', text: 'Answer.' }] }],
      reasoningText: '',
      providerMetadata: null,
    }
    await streamCallbacks().onEnd(result)

    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        chatbotId: 'chatbot-1',
        usageClass: 'BASE',
        threadId: 'thread-1',
        assistantMessageId: 'assistant-1',
        modelId: 'gpt-4.1-mini',
        rawCreditsUsed: 0.000012,
      })
    )
    expect(mocks.finalizeChatTurn.mock.calls[0][0]).not.toHaveProperty(
      'participantId'
    )
    expect(mocks.decrementCredits).toHaveBeenCalledOnce()
    expect(mocks.decrementCredits).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1',
      0.000012
    )

    expect(
      responseOptions().messageMetadata({
        part: {
          type: 'finish',
          finishReason: 'stop',
          totalUsage: result.usage,
        },
      })
    ).toMatchObject({
      modelId: 'gpt-4.1-mini',
      creditsUsed: 0.000012,
    })
  })

  test('persists missing terminal usage without either credit decrement', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await streamCallbacks().onEnd({
      usage: null,
      steps: [{ content: [{ type: 'text', text: 'Answer.' }] }],
      reasoningText: '',
    })

    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ rawCreditsUsed: null })
    )
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })

  test('finalizes an empty terminal result and charges reliable usage once', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await streamCallbacks().onEnd({
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      steps: [],
    })

    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [],
        rawCreditsUsed: 0.00006,
      })
    )
    expect(mocks.decrementCredits).toHaveBeenCalledOnce()
    expect(mocks.decrementCredits).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1',
      0.00006
    )
  })

  test('keeps invalid complete usage uncharged and metadata safe', async () => {
    mocks.roundChatUsageCredits.mockImplementation(() => {
      throw new RangeError('synthetic invalid cost')
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await expect(
      streamCallbacks().onEnd({
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        steps: [{ content: [{ type: 'text', text: 'Answer.' }] }],
      })
    ).resolves.toBeUndefined()

    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ rawCreditsUsed: null })
    )
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
    expect(
      responseOptions().messageMetadata({
        part: {
          type: 'finish',
          finishReason: 'stop',
          totalUsage: { inputTokens: 10, outputTokens: 5 },
        },
      })
    ).toMatchObject({ creditsUsed: null })
  })

  test('keeps invalid aborted usage uncharged without throwing', async () => {
    mocks.roundChatUsageCredits.mockImplementation(() => {
      throw new RangeError('synthetic invalid cost')
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await expect(
      streamCallbacks().onAbort({
        steps: [
          {
            content: [{ type: 'text', text: 'Partial answer.' }],
            usage: { inputTokens: 10, outputTokens: 5 },
          },
        ],
      })
    ).resolves.toBeUndefined()

    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ rawCreditsUsed: null })
    )
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })

  test('does not decrement participant credits for a duplicate finalization', async () => {
    mocks.finalizeChatTurn.mockResolvedValueOnce({
      outcome: 'duplicate',
      creditsUsed: 0.00006,
    })
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await streamCallbacks().onEnd({
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      steps: [{ content: [{ type: 'text', text: 'Answer.' }] }],
    })

    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })

  test('does not decrement participant credits for a finalization conflict', async () => {
    mocks.finalizeChatTurn.mockRejectedValueOnce(
      new mocks.ChatTurnConflictError()
    )
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await streamCallbacks().onEnd({
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      steps: [{ content: [{ type: 'text', text: 'Answer.' }] }],
    })

    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })

  test('does not decrement participant credits after an unknown finalization error', async () => {
    mocks.finalizeChatTurn.mockRejectedValueOnce(
      new Error('synthetic finalization failure')
    )
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await streamCallbacks().onEnd({
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      steps: [{ content: [{ type: 'text', text: 'Answer.' }] }],
    })

    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })

  test('charges an aborted tool loop once and suppresses its late end', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    const steps = [
      {
        content: [{ type: 'text', text: 'First step.' }],
        usage: { inputTokens: 4, outputTokens: 2 },
      },
      {
        content: [{ type: 'text', text: 'Second step.' }],
        usage: { inputTokens: 6, outputTokens: 3 },
      },
    ]
    await streamCallbacks().onAbort({ steps })
    await streamCallbacks().onEnd({
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      steps,
    })

    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        rawCreditsUsed: 0.00006,
        content: expect.arrayContaining([
          { type: 'data', name: 'chat-stopped', data: {} },
        ]),
      })
    )
    expect(mocks.decrementCredits).toHaveBeenCalledOnce()
  })
})
