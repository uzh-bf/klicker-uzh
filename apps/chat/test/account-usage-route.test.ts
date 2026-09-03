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
  closeMCPTools: vi.fn(),
  loadResponseExampleRuntimeSkill: vi.fn(),
  createResponseExampleSearchTool: vi.fn(),
  buildPromptCacheRequest: vi.fn(),
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

vi.mock('@/src/lib/server/responseExampleRuntime', () => ({
  RESPONSE_EXAMPLE_SEARCH_TOOL_NAME: 'search_response_examples',
  loadResponseExampleRuntimeSkill: mocks.loadResponseExampleRuntimeSkill,
  createResponseExampleSearchTool: mocks.createResponseExampleSearchTool,
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
  buildPromptCacheRequest: mocks.buildPromptCacheRequest,
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
    course: { displayName: 'Test Course' },
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
  selectedMode = 'tutor',
  assistantMessageId = 'assistant-1',
  images = [],
  threadId = 'thread-1',
  allowRegeneration = false,
}: {
  selectedModel?: string
  selectedMode?: string
  assistantMessageId?: string
  images?: string[]
  threadId?: string | null
  allowRegeneration?: boolean
} = {}) {
  return new NextRequest('http://localhost/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ id: 'message-1', role: 'user', content: 'Explain this.' }],
      threadId,
      selectedModel,
      selectedMode,
      assistantMessageId,
      ...(allowRegeneration ? { allowRegeneration: true } : {}),
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
    mocks.getAggregatedMCPTools.mockResolvedValue({
      tools: {},
      close: mocks.closeMCPTools,
    })
    mocks.loadResponseExampleRuntimeSkill.mockResolvedValue({
      summary: '',
      setDigest: 'synthetic-set-digest',
      projectionDigest: 'synthetic-projection-digest',
      search: vi.fn(),
    })
    mocks.createResponseExampleSearchTool.mockReturnValue({
      description: 'Synthetic response-example search tool',
    })
    mocks.buildPromptCacheRequest.mockResolvedValue(null)
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
    mocks.threadFindFirst.mockResolvedValue({ id: 'thread-1' })
    mocks.attachmentFindMany.mockResolvedValue([])
    mocks.messageUpdateMany.mockResolvedValue({ count: 0 })
    mocks.messageFindUnique.mockResolvedValue(null)
    mocks.messageCreate.mockResolvedValue({ id: 'message-1' })
    mocks.threadUpdate.mockResolvedValue({ id: 'thread-1' })
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

  test('adds the response-example summary and tool to the final cache identity', async () => {
    mocks.loadResponseExampleRuntimeSkill.mockResolvedValueOnce({
      summary: 'Response-example skill\nSynthetic lecturer guidance.',
      setDigest: 'synthetic-set-digest',
      projectionDigest: 'synthetic-projection-digest',
      search: vi.fn(),
    })
    const responseExampleTool = {
      description: 'Synthetic response-example search tool',
    }
    mocks.createResponseExampleSearchTool.mockReturnValueOnce(
      responseExampleTool
    )

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
    expect(mocks.claimChatTurn.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getAggregatedMCPTools.mock.invocationCallOrder[0]
    )
    expect(
      mocks.getAggregatedMCPTools.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mocks.loadResponseExampleRuntimeSkill.mock.invocationCallOrder[0]
    )
    expect(mocks.loadResponseExampleRuntimeSkill).toHaveBeenCalledWith({
      prisma: expect.anything(),
      chatbotId: 'chatbot-1',
      chatMode: 'tutor',
      role: 'included',
    })
    expect(mocks.buildPromptCacheRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('Synthetic lecturer guidance.'),
        tools: expect.objectContaining({
          search_response_examples: responseExampleTool,
        }),
      })
    )
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('Synthetic lecturer guidance.'),
        tools: expect.objectContaining({
          search_response_examples: responseExampleTool,
        }),
        runtimeContext: {
          responseExampleRole: 'included',
          responseExampleSkillAvailable: true,
          responseExampleSetDigest: 'synthetic-set-digest',
          responseExampleProjectionDigest: 'synthetic-projection-digest',
        },
        telemetry: expect.objectContaining({
          includeRuntimeContext: {
            responseExampleRole: true,
            responseExampleSkillAvailable: true,
            responseExampleSetDigest: true,
            responseExampleProjectionDigest: true,
          },
        }),
      })
    )
  })

  test('continues the claimed turn when response-example loading fails', async () => {
    mocks.loadResponseExampleRuntimeSkill.mockRejectedValueOnce(
      new Error('synthetic response-example loader failure')
    )

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.streamText).toHaveBeenCalledOnce()
    expect(mocks.buildPromptCacheRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.not.stringContaining('Response-example skill'),
        tools: expect.not.objectContaining({
          search_response_examples: expect.anything(),
        }),
      })
    )
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeContext: {
          responseExampleRole: 'included',
          responseExampleSkillAvailable: false,
          responseExampleSetDigest: 'unavailable',
          responseExampleProjectionDigest: 'unavailable',
        },
      })
    )
    expect(streamCallbacks()).not.toHaveProperty(
      'tools.search_response_examples'
    )
    expect(console.warn).toHaveBeenCalledWith(
      'Response-example skill loading failed; continuing without response examples',
      expect.objectContaining({ chatbotId: 'chatbot-1' })
    )
  })

  test('omits the whole skill when response-example tool construction fails', async () => {
    mocks.loadResponseExampleRuntimeSkill.mockResolvedValueOnce({
      summary: 'Response-example skill\nSynthetic lecturer guidance.',
      setDigest: 'synthetic-set-digest',
      projectionDigest: 'synthetic-projection-digest',
      search: vi.fn(),
    })
    mocks.createResponseExampleSearchTool.mockImplementationOnce(() => {
      throw new Error('synthetic response-example tool failure')
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.buildPromptCacheRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.not.stringContaining(
          'Synthetic lecturer guidance.'
        ),
        tools: expect.not.objectContaining({
          search_response_examples: expect.anything(),
        }),
      })
    )
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeContext: {
          responseExampleRole: 'included',
          responseExampleSkillAvailable: false,
          responseExampleSetDigest: 'unavailable',
          responseExampleProjectionDigest: 'unavailable',
        },
      })
    )
  })

  test('preserves an MCP tool collision and omits the response-example skill', async () => {
    const mcpTool = { description: 'Synthetic MCP-owned tool' }
    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: { search_response_examples: mcpTool },
      close: mocks.closeMCPTools,
    })
    mocks.loadResponseExampleRuntimeSkill.mockResolvedValueOnce({
      summary: 'Response-example skill\nSynthetic lecturer guidance.',
      setDigest: 'synthetic-set-digest',
      projectionDigest: 'synthetic-projection-digest',
      search: vi.fn(),
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.createResponseExampleSearchTool).not.toHaveBeenCalled()
    expect(mocks.buildPromptCacheRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.not.stringContaining(
          'Synthetic lecturer guidance.'
        ),
        tools: expect.objectContaining({ search_response_examples: mcpTool }),
      })
    )
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({ search_response_examples: mcpTool }),
        runtimeContext: {
          responseExampleRole: 'included',
          responseExampleSkillAvailable: false,
          responseExampleSetDigest: 'unavailable',
          responseExampleProjectionDigest: 'unavailable',
        },
      })
    )
    expect(console.warn).toHaveBeenCalledWith(
      'Response-example skill name conflicts with an existing tool; continuing without response examples',
      expect.objectContaining({ chatbotId: 'chatbot-1' })
    )
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

  test('defaults omitted regeneration to a normal turn claim', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.claimChatTurn).toHaveBeenCalledOnce()
    expect(mocks.claimChatTurn.mock.calls[0]?.[0]).not.toHaveProperty(
      'allowRegeneration'
    )
  })

  test('passes explicit regeneration to the turn claim', async () => {
    const response = await POST(createRequest({ allowRegeneration: true }), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.claimChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ allowRegeneration: true })
    )
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
      'assistant-1'
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

  test('forces Quizzer course retrieval only on the first model step', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({
        systemPrompts: {
          tutor: { prompt: 'Use course material.' },
          quizzer: { prompt: 'Ask course questions.' },
        },
        mcpConfigurations: [
          {
            chatMode: 'quizzer',
            isEnabled: true,
            priority: 0,
            allowedTools: ['doc_query'],
            parameters: null,
            mcpServer: { id: 'server-1' },
          },
        ],
      })
    )
    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: { KB_doc_query: {} },
      close: mocks.closeMCPTools,
    })

    const response = await POST(createRequest({ selectedMode: 'quizzer' }), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    const prepareStep = mocks.streamConfig?.prepareStep as (input: {
      stepNumber: number
    }) => unknown
    expect(prepareStep({ stepNumber: 0 })).toEqual({
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
    expect(prepareStep({ stepNumber: 1 })).toEqual({})
  })

  test('routes zero-credit ADVANCED usage to Luna BASE', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({
        allowedModelIds: ['gpt-4.1', 'gpt-5.6-luna'],
      })
    )
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(createRequest({ selectedModel: 'gpt-4.1' }), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'BASE',
    })
    expect(mocks.getUserCredits).not.toHaveBeenCalled()
    expect(mocks.streamText).toHaveBeenCalledOnce()
  })

  test('routes automatic zero-credit usage to Luna BASE', async () => {
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

    expect(response.status).toBe(200)
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'BASE',
    })
    expect(mocks.streamText).toHaveBeenCalledOnce()
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

  test('uses Luna when the chatbot allow-list excludes it', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({ allowedModelIds: ['gpt-4.1'] })
    )
    mocks.previewUserCredits.mockResolvedValueOnce({ current: 0, total: 5 })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'BASE',
    })
    expect(mocks.streamText).toHaveBeenCalledOnce()
  })

  test('uses Luna when only a retired model remains in the automatic allow-list', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({ modelSelection: false, allowedModelIds: ['gpt-4.1-mini'] })
    )

    const response = await POST(
      createRequest({ selectedModel: 'gpt-4.1-mini' }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'BASE',
    })
    expect(mocks.streamText).toHaveBeenCalledOnce()
  })

  test('allows Luna when model selection is enabled but only retired models remain', async () => {
    mocks.chatbotFindUnique.mockResolvedValueOnce(
      chatbot({ allowedModelIds: ['gpt-4.1-mini'] })
    )

    const response = await POST(
      createRequest({ selectedModel: 'gpt-5.6-luna' }),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'BASE',
    })
    expect(mocks.streamText).toHaveBeenCalledOnce()
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

    expect(mocks.closeMCPTools).toHaveBeenCalledOnce()
    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        chatbotId: 'chatbot-1',
        usageClass: 'BASE',
        threadId: 'thread-1',
        assistantMessageId: 'assistant-1',
        participantId: 'participant-1',
        lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
        modelId: 'gpt-5.6-luna',
        rawCreditsUsed: 0.000008,
      })
    )
    expect(mocks.decrementCredits).not.toHaveBeenCalled()

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

  test('does not charge an empty terminal result', async () => {
    mocks.finalizeChatTurn.mockResolvedValueOnce({
      outcome: 'empty',
      creditsUsed: null,
    })
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
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
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

    expect(mocks.closeMCPTools).toHaveBeenCalledOnce()
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

    expect(mocks.closeMCPTools).toHaveBeenCalledOnce()
    expect(mocks.finalizeChatTurn).toHaveBeenCalledOnce()
    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        rawCreditsUsed: 0.00006,
        content: expect.arrayContaining([
          { type: 'data', name: 'chat-stopped', data: {} },
        ]),
      })
    )
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })

  test('marks a provider error as failed so the same key can be retried', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })
    expect(response.status).toBe(200)

    await streamCallbacks().onError(new Error('synthetic provider failure'))

    expect(mocks.closeMCPTools).toHaveBeenCalledOnce()
    expect(mocks.failChatTurn).toHaveBeenCalledWith({
      assistantMessageId: 'assistant-1',
      threadId: 'thread-1',
      lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
    })
    expect(mocks.finalizeChatTurn).not.toHaveBeenCalled()
    expect(mocks.decrementCredits).not.toHaveBeenCalled()
  })
})
