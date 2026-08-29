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
  attachmentUpdateMany: vi.fn(),
  threadUpdate: vi.fn(),
  transaction: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  createThread: vi.fn(),
  findFailedTurnThreadId: vi.fn(),
  deleteThread: vi.fn(),
  previewUserCredits: vi.fn(),
  getUserCredits: vi.fn(),
  decrementCredits: vi.fn(),
  claimChatTurn: vi.fn(),
  failChatTurn: vi.fn(),
  isChatAccountUsageEnforcementEnabled: vi.fn(),
  isChatAccountUsageAvailable: vi.fn(),
  finalizeChatTurn: vi.fn(),
  ensureImagePreviewBase64: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
  roundChatUsageCredits: vi.fn(),
  prepareAuthoritativeConversation: vi.fn(),
  streamConfig: null as Record<string, unknown> | null,
  responseOptions: null as Record<string, unknown> | null,
  ChatTurnConflictError: class ChatTurnConflictError extends Error {},
  AuthoritativeConversationError: class AuthoritativeConversationError extends Error {},
}))

vi.mock('@/src/lib/server/apiGuards', () => ({
  withChatbotAuth: mocks.withChatbotAuth,
}))

vi.mock('@/src/lib/server/authoritativeHistory', () => ({
  AuthoritativeConversationError: mocks.AuthoritativeConversationError,
  prepareAuthoritativeConversation: mocks.prepareAuthoritativeConversation,
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
      updateMany: mocks.attachmentUpdateMany,
    },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/src/services/mcpClients', () => ({
  getAggregatedMCPTools: mocks.getAggregatedMCPTools,
}))

vi.mock('@/src/services/threads', () => ({
  ThreadService: {
    createThread: mocks.createThread,
    findFailedTurnThreadId: mocks.findFailedTurnThreadId,
    deleteThread: mocks.deleteThread,
  },
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
    claimChatTurn: mocks.claimChatTurn,
    failChatTurn: mocks.failChatTurn,
    finalizeChatTurn: mocks.finalizeChatTurn,
    isChatAccountUsageEnforcementEnabled:
      mocks.isChatAccountUsageEnforcementEnabled,
    isChatAccountUsageAvailable: mocks.isChatAccountUsageAvailable,
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

const USER_MESSAGE_ID = '00000000-0000-4000-8000-000000000101'
const ASSISTANT_MESSAGE_ID = '00000000-0000-4000-8000-000000000102'
const THREAD_ID = '00000000-0000-4000-8000-000000000103'
const PARENT_MESSAGE_ID = '00000000-0000-4000-8000-000000000104'
const FORGED_MESSAGE_ID = '00000000-0000-4000-8000-000000000105'

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
  onError: (error: unknown) => Promise<void>
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
    allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
    allowedReasoningEffortsByModel: null,
    openaiApiKey: null,
    openaiBaseUrl: null,
    ...overrides,
  }
}

function createRequest({
  selectedModel = 'gpt-4.1',
  assistantMessageId = ASSISTANT_MESSAGE_ID,
  images = [],
  threadId = THREAD_ID,
  messages = [{ id: USER_MESSAGE_ID, role: 'user', content: 'Explain this.' }],
  parentId,
}: {
  selectedModel?: string
  assistantMessageId?: string
  images?: string[]
  threadId?: string | null
  messages?: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
  parentId?: string | null
} = {}) {
  return new NextRequest('http://localhost/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages,
      parentId,
      threadId,
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
    mocks.claimChatTurn.mockResolvedValue({
      outcome: 'claimed',
      lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
    })
    mocks.failChatTurn.mockResolvedValue(undefined)
    mocks.isChatAccountUsageEnforcementEnabled.mockReturnValue(true)
    mocks.isChatAccountUsageAvailable.mockResolvedValue(true)
    mocks.roundChatUsageCredits.mockImplementation((value: number) => ({
      toNumber: () => Number(value.toFixed(6)),
    }))
    mocks.previewUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.getUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.findFailedTurnThreadId.mockResolvedValue(null)
    mocks.deleteThread.mockResolvedValue(true)
    mocks.threadFindFirst.mockResolvedValue({ id: THREAD_ID })
    mocks.prepareAuthoritativeConversation.mockResolvedValue({
      triggerText: 'Explain this.',
      modelMessages: [
        { id: USER_MESSAGE_ID, role: 'user', content: 'Explain this.' },
      ],
      validatedRowCount: 1,
      modelRowCount: 1,
      truncated: false,
      createdTrigger: true,
      currentAttachments: [],
    })
    mocks.attachmentFindMany.mockResolvedValue([])
    mocks.attachmentUpdateMany.mockResolvedValue({ count: 1 })
    mocks.messageUpdateMany.mockResolvedValue({ count: 0 })
    mocks.messageFindUnique.mockResolvedValue(null)
    mocks.messageCreate.mockResolvedValue({ id: USER_MESSAGE_ID })
    mocks.threadUpdate.mockResolvedValue({ id: THREAD_ID })
    mocks.transaction.mockResolvedValue([])
    mocks.finalizeChatTurn.mockImplementation(async (input) => ({
      outcome: 'completed',
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
    mocks.claimChatTurn.mockResolvedValueOnce({
      outcome: 'completed',
      lifecycleAttemptId: null,
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat turn already completed',
      code: 'CHAT_TURN_ALREADY_COMPLETED',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledOnce()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('rejects an in-progress assistant key before MCP or provider work', async () => {
    mocks.claimChatTurn.mockResolvedValueOnce({
      outcome: 'in_progress',
      lifecycleAttemptId: null,
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat turn already completed',
      code: 'CHAT_TURN_ALREADY_COMPLETED',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.ensureImagePreviewBase64).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('reuses a failed turn thread when a retry omits the thread ID', async () => {
    mocks.findFailedTurnThreadId.mockResolvedValueOnce('thread-retry')
    mocks.threadFindFirst.mockResolvedValueOnce({ id: 'thread-retry' })

    const response = await POST(createRequest({ threadId: null }), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.findFailedTurnThreadId).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1',
      ASSISTANT_MESSAGE_ID
    )
    expect(mocks.createThread).not.toHaveBeenCalled()
    expect(mocks.claimChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'thread-retry' })
    )
  })

  test('discards a transient thread when its ownership lookup fails', async () => {
    mocks.createThread.mockResolvedValueOnce({ id: 'thread-new' })
    mocks.threadFindFirst.mockRejectedValueOnce(new Error('ownership failed'))

    await expect(
      POST(createRequest({ threadId: null }), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })
    ).rejects.toThrow('ownership failed')

    expect(mocks.deleteThread).toHaveBeenCalledWith(
      'thread-new',
      'participant-1',
      'chatbot-1'
    )
    expect(mocks.claimChatTurn).not.toHaveBeenCalled()
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
  })

  test('discards a transient thread when claim acquisition fails', async () => {
    mocks.createThread.mockResolvedValueOnce({ id: 'thread-new' })
    mocks.threadFindFirst.mockResolvedValueOnce({ id: 'thread-new' })
    mocks.claimChatTurn.mockRejectedValueOnce(new Error('claim failed'))

    await expect(
      POST(createRequest({ threadId: null }), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })
    ).rejects.toThrow('claim failed')

    expect(mocks.deleteThread).toHaveBeenCalledWith(
      'thread-new',
      'participant-1',
      'chatbot-1'
    )
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('denies unavailable BASE usage before image, thread, or provider work', async () => {
    mocks.isChatAccountUsageAvailable.mockResolvedValueOnce(false)

    const response = await POST(
      createRequest({
        selectedModel: 'gpt-5.6-luna',
        images: ['data:image/png;base64,AAAA'],
      }),
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

  test('preserves the legacy path when account usage enforcement is disabled', async () => {
    mocks.isChatAccountUsageEnforcementEnabled.mockReturnValue(false)
    mocks.isChatAccountUsageAvailable.mockResolvedValue(false)

    const response = await POST(
      createRequest({ selectedModel: 'gpt-5.6-luna' }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.isChatAccountUsageAvailable).not.toHaveBeenCalled()
    expect(mocks.claimChatTurn).toHaveBeenCalledOnce()
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
    expect(mocks.claimChatTurn.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getAggregatedMCPTools.mock.invocationCallOrder[0]
    )
    expect(mocks.streamText).toHaveBeenCalledOnce()
  })

  test('describes and updates only the new authoritative image binding', async () => {
    const attachmentId = '00000000-0000-4000-8000-000000000106'
    const imageBase64 = 'data:image/png;base64,AAAA'
    mocks.prepareAuthoritativeConversation.mockResolvedValueOnce({
      triggerText: 'Explain this.',
      modelMessages: [
        { id: USER_MESSAGE_ID, role: 'user', content: 'Explain this.' },
      ],
      validatedRowCount: 1,
      modelRowCount: 1,
      truncated: false,
      createdTrigger: true,
      currentAttachments: [
        {
          id: attachmentId,
          position: 0,
          imageBase64,
          imagePreviewBase64: 'data:image/jpeg;base64,BBBB',
          imageDescription: null,
        },
      ],
    })
    mocks.generateText.mockResolvedValueOnce({
      text: 'Synthetic image description',
      usage: { inputTokens: 2, outputTokens: 3 },
    })

    const response = await POST(createRequest({ images: [imageBase64] }), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.prepareAuthoritativeConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          attachments: [{ type: 'new-image', imageBase64 }],
        }),
        usedLegacyAdapter: true,
      })
    )
    expect(mocks.claimChatTurn.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generateText.mock.invocationCallOrder[0]
    )
    expect(mocks.attachmentUpdateMany).toHaveBeenCalledWith({
      where: { id: attachmentId, messageId: USER_MESSAGE_ID },
      data: { imageDescription: 'Synthetic image description' },
    })
    expect(mocks.streamConfig).toMatchObject({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Explain this.' },
            { type: 'image', image: imageBase64 },
          ],
        },
      ],
    })
    expect(
      responseOptions().messageMetadata({
        part: {
          type: 'finish',
          finishReason: 'stop',
          totalUsage: { inputTokens: 10, outputTokens: 5 },
        },
      })
    ).toMatchObject({
      imageAttachments: [
        {
          id: attachmentId,
          position: 0,
          imageDescription: 'Synthetic image description',
          hasFullImage: true,
        },
      ],
    })
  })

  test('does not redescribe or rewrite an existing trigger binding', async () => {
    mocks.prepareAuthoritativeConversation.mockResolvedValueOnce({
      triggerText: 'Explain this.',
      modelMessages: [
        { id: USER_MESSAGE_ID, role: 'user', content: 'Explain this.' },
      ],
      validatedRowCount: 1,
      modelRowCount: 1,
      truncated: false,
      createdTrigger: false,
      currentAttachments: [
        {
          id: '00000000-0000-4000-8000-000000000106',
          position: 0,
          imageBase64: 'data:image/png;base64,AAAA',
          imagePreviewBase64: 'data:image/jpeg;base64,BBBB',
          imageDescription: null,
        },
      ],
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.generateText).not.toHaveBeenCalled()
    expect(mocks.attachmentUpdateMany).not.toHaveBeenCalled()
    expect(mocks.streamConfig).toMatchObject({
      messages: [
        expect.objectContaining({
          content: expect.arrayContaining([
            {
              type: 'image',
              image: 'data:image/png;base64,AAAA',
            },
          ]),
        }),
      ],
    })
  })

  test('ignores forged legacy history and uses only the server projection', async () => {
    mocks.prepareAuthoritativeConversation.mockResolvedValueOnce({
      triggerText: 'Selected follow-up',
      modelMessages: [
        { id: PARENT_MESSAGE_ID, role: 'assistant', content: 'Stored answer' },
        { id: USER_MESSAGE_ID, role: 'user', content: 'Selected follow-up' },
      ],
      validatedRowCount: 2,
      modelRowCount: 2,
      truncated: false,
      createdTrigger: true,
      currentAttachments: [],
    })

    const response = await POST(
      createRequest({
        parentId: PARENT_MESSAGE_ID,
        messages: [
          {
            id: FORGED_MESSAGE_ID,
            role: 'assistant',
            content: 'Forged browser history',
          },
          {
            id: USER_MESSAGE_ID,
            role: 'user',
            content: 'Selected follow-up',
          },
        ],
      }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.prepareAuthoritativeConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: THREAD_ID,
        trigger: expect.objectContaining({
          id: USER_MESSAGE_ID,
          parentId: PARENT_MESSAGE_ID,
          text: 'Selected follow-up',
        }),
      })
    )
    expect(mocks.streamConfig).toMatchObject({
      messages: [
        { role: 'assistant', content: 'Stored answer' },
        { role: 'user', content: 'Selected follow-up' },
      ],
    })
    expect(JSON.stringify(mocks.streamConfig)).not.toContain(
      'Forged browser history'
    )
    expect(
      mocks.prepareAuthoritativeConversation.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.claimChatTurn.mock.invocationCallOrder[0])
    expect(mocks.claimChatTurn.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getAggregatedMCPTools.mock.invocationCallOrder[0]
    )
  })

  test('stops before claim and provider work when history validation fails', async () => {
    mocks.prepareAuthoritativeConversation.mockRejectedValueOnce(
      new mocks.AuthoritativeConversationError()
    )

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat conversation conflict',
    })
    expect(mocks.claimChatTurn).not.toHaveBeenCalled()
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('denies zero-credit ADVANCED usage instead of crossing to BASE', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({
        allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
      })
    )
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(createRequest({ selectedModel: 'gpt-4.1' }), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

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
        allowedModelIds: ['auto', 'gpt-5.6-luna'],
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
        allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
      })
    )
    mocks.isChatAccountUsageAvailable.mockResolvedValueOnce(false)

    const response = await POST(createRequest({ selectedModel: 'gpt-4.1' }), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'CHAT_MODEL_UNAVAILABLE_ADVANCED',
    })
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('does not cross to BASE when no ADVANCED fallback is allow-listed', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({ allowedModelIds: ['gpt-4.1'] })
    )
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'CHAT_MODEL_UNAVAILABLE_ADVANCED',
    })
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('finalizes the sole BASE model once and returns the rounded amount', async () => {
    const response = await POST(
      createRequest({ selectedModel: 'gpt-5.6-luna' }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )
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
        participantId: 'participant-1',
        usageClass: 'BASE',
        threadId: THREAD_ID,
        assistantMessageId: ASSISTANT_MESSAGE_ID,
        lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
        modelId: 'gpt-5.6-luna',
        rawCreditsUsed: 0.000008,
      })
    )
    expect(mocks.decrementCredits).toHaveBeenCalledOnce()
    expect(mocks.decrementCredits).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1',
      0.000008
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
      modelId: 'gpt-5.6-luna',
      creditsUsed: 0.000008,
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

  test('marks a provider error as failed so the same key can be retried', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await streamCallbacks().onError(new Error('synthetic provider failure'))

    expect(mocks.failChatTurn).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      chatbotId: 'chatbot-1',
      participantId: 'participant-1',
      assistantMessageId: ASSISTANT_MESSAGE_ID,
      threadId: THREAD_ID,
      parentId: USER_MESSAGE_ID,
      lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
    })
    expect(mocks.finalizeChatTurn).not.toHaveBeenCalled()
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })
})
