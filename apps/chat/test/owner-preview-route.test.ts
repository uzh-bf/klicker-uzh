import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildPromptCacheRequest: vi.fn(),
  compileSystemPrompt: vi.fn(),
  convertToModelMessages: vi.fn(),
  closeMcpTools: vi.fn(),
  createChatMessage: vi.fn(),
  createChatThread: vi.fn(),
  createParticipant: vi.fn(),
  findChatbot: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  getChatModel: vi.fn(),
  getAutomaticModelId: vi.fn(),
  getModelsForChatbot: vi.fn(),
  rateLimitCheck: vi.fn(),
  readBoundedJson: vi.fn(),
  streamText: vi.fn(),
  validateManageChatRequest: vi.fn(),
  withOwnerPreviewAuth: vi.fn(),
}))

vi.mock('@/src/lib/server/ownerPreviewAuth', () => ({
  withOwnerPreviewAuth: mocks.withOwnerPreviewAuth,
}))

vi.mock('@/src/services/rateLimiter', () => ({
  createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}))

vi.mock('@/src/lib/server/manageChatRequest', () => ({
  MANAGE_CHAT_BODY_TIMEOUT_MS: 30_000,
  MANAGE_CHAT_TOTAL_TIMEOUT_MS: 60_000,
  readBoundedJson: mocks.readBoundedJson,
  validateManageChatRequest: mocks.validateManageChatRequest,
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatbot: { findUnique: mocks.findChatbot },
    chatMessage: { create: mocks.createChatMessage },
    chatThread: { create: mocks.createChatThread },
    participant: { create: mocks.createParticipant },
  },
}))

vi.mock('@/src/services/mcpClients', () => ({
  getAggregatedMCPTools: mocks.getAggregatedMCPTools,
}))

vi.mock('@/src/lib/server/chatModelRegistry', () => ({
  getAutomaticModelId: mocks.getAutomaticModelId,
  getModelsForChatbot: mocks.getModelsForChatbot,
}))

vi.mock('@/src/lib/server/chatModelProvider', () => ({
  getChatModel: mocks.getChatModel,
}))

vi.mock('@/src/lib/server/promptCacheIdentity', () => ({
  buildPromptCacheRequest: mocks.buildPromptCacheRequest,
}))

vi.mock('@/src/lib/server/systemPromptCompiler', () => ({
  compileSystemPrompt: mocks.compileSystemPrompt,
}))

vi.mock('@/src/lib/server/openaiResponsesOptions', () => ({
  getOpenAIResponsesStore: () => true,
}))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  convertToModelMessages: mocks.convertToModelMessages,
  isStepCount: () => vi.fn(),
  streamText: mocks.streamText,
}))

import { POST } from '@/src/app/api/manage/chatbots/[chatbotId]/preview/chat/route'

const uiMessages = [
  {
    id: 'user-message',
    parts: [{ text: 'Explain this topic.', type: 'text' as const }],
    role: 'user' as const,
  },
]

const originalKbId = '11111111-1111-4111-8111-111111111111'
const additionalKbId = '22222222-2222-4222-8222-222222222222'

const baseModel = {
  cost: { input: 0.2, output: 1.2 },
  description: 'Base model',
  deploymentId: 'base-model',
  fallback: true,
  id: 'base-model',
  maxOutputTokens: 2048,
  name: 'Base model',
  supportsImageAttachments: false,
  supportsReasoning: false,
  supportedReasoningEfforts: [],
  usageClass: 'BASE',
  usesResponsesApi: true,
}

const defaultStandardModeConfig = {
  courseName: null,
  explainerEnabled: false,
  languageOfInstruction: null,
  quizzerEnabled: false,
  scopeNote: null,
  subjectDomain: null,
  tutorEnabled: true,
}

function createChatbot(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    allowedModelIds: ['base-model'],
    allowedReasoningEffortsByModel: null,
    course: { displayName: 'Test Course' },
    id: 'chatbot-id',
    knowledgeBases: [{ kbId: originalKbId }],
    mcpConfigurations: [
      {
        allowedTools: ['*', 'delete_all'],
        chatMode: 'tutor',
        isEnabled: true,
        parameters: {
          kb_id: originalKbId,
          required: true,
          toolAlias: 'doc_query',
        },
        priority: 1,
        mcpServer: {
          authSecret: null,
          authType: 'scope_token',
          chatbotIdHeader: null,
          id: 'kb-server',
          isActive: true,
          name: 'KB',
          parameters: {},
          passChatbotId: false,
          url: 'http://kb.test/mcp',
        },
      },
    ],
    modelSelection: false,
    owner: { aiFeaturesEnabled: true },
    ownerId: 'owner-id',
    standardModeConfig: defaultStandardModeConfig,
    systemPrompts: { tutor: 'Tutor instructions' },
    ...overrides,
  }
}

function request() {
  return new NextRequest(
    'https://chat.test/api/manage/chatbots/chatbot-id/preview/chat',
    { body: '{}', method: 'POST' }
  )
}

function setRequestOptions(options: Record<string, unknown>) {
  mocks.readBoundedJson.mockResolvedValue({
    ok: true,
    value: { messages: uiMessages, ...options },
  })
}

describe('POST owner preview chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withOwnerPreviewAuth.mockResolvedValue({
      scope: 'ACCOUNT_OWNER',
      userId: 'owner-id',
    })
    mocks.rateLimitCheck.mockReturnValue({
      allowed: true,
      remaining: 19,
      retryAfterMs: 0,
    })
    mocks.readBoundedJson.mockResolvedValue({
      ok: true,
      value: { messages: uiMessages, selectedMode: 'tutor' },
    })
    mocks.validateManageChatRequest.mockResolvedValue({ messages: uiMessages })
    mocks.findChatbot.mockResolvedValue(createChatbot())
    mocks.getAggregatedMCPTools.mockResolvedValue({
      close: mocks.closeMcpTools,
      tools: {
        KB_doc_query: { description: 'Search course material' },
      },
    })
    mocks.compileSystemPrompt.mockReturnValue('Compiled prompt')
    mocks.getModelsForChatbot.mockReturnValue([
      { ...baseModel, id: 'advanced-model', usageClass: 'ADVANCED' },
      baseModel,
    ])
    mocks.getAutomaticModelId.mockReturnValue('base-model')
    mocks.convertToModelMessages.mockResolvedValue([{ role: 'user' }])
    mocks.getChatModel.mockReturnValue({
      model: { modelId: 'base-model' },
      routing: { source: 'custom' },
    })
    mocks.streamText.mockReturnValue({
      toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response('ok')),
    })
  })

  it('fails before body or database work when owner authorization is denied', async () => {
    mocks.withOwnerPreviewAuth.mockResolvedValue({
      response: new Response('Forbidden', { status: 403 }),
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(403)
    expect(mocks.readBoundedJson).not.toHaveBeenCalled()
    expect(mocks.findChatbot).not.toHaveBeenCalled()
  })

  it('rejects an unapproved owner before model resolution or provider work', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({ owner: { aiFeaturesEnabled: false } })
    )

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(403)
    expect(mocks.getModelsForChatbot).not.toHaveBeenCalled()
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.getChatModel).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('rate limits before reading or validating the request body', async () => {
    mocks.rateLimitCheck.mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 5_000,
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('5')
    expect(mocks.readBoundedJson).not.toHaveBeenCalled()
    expect(mocks.findChatbot).not.toHaveBeenCalled()
  })

  it('rejects an invalid body before database or provider work', async () => {
    mocks.readBoundedJson.mockResolvedValue({
      error: 'INVALID_JSON',
      ok: false,
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.validateManageChatRequest).not.toHaveBeenCalled()
    expect(mocks.findChatbot).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('streams with the saved model and exposes only doc_query from the KB server', async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chatbot-id' }),
      expect.objectContaining(baseModel)
    )
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          config: expect.objectContaining({ allowedTools: ['doc_query'] }),
        }),
      ],
      expect.objectContaining({
        authMode: 'account',
        chatbotId: 'chatbot-id',
        kbIds: [originalKbId],
      })
    )
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ tutor: 'Tutor instructions' }),
      'tutor',
      {
        courseDisplayName: 'Test Course',
        toolNames: ['KB_doc_query'],
        standardModeConfig: defaultStandardModeConfig,
      }
    )
    expect(mocks.streamText).toHaveBeenCalledOnce()
    const streamOptions = mocks.streamText.mock.calls[0]![0]
    await streamOptions.onEnd()
    await streamOptions.onAbort()
    expect(mocks.closeMcpTools).toHaveBeenCalledOnce()
    expect(mocks.createChatMessage).not.toHaveBeenCalled()
    expect(mocks.createChatThread).not.toHaveBeenCalled()
    expect(mocks.createParticipant).not.toHaveBeenCalled()
  })

  it('uses the configured multi-KB scope even without matching KB relations', async () => {
    const chatbot = await mocks.findChatbot()
    chatbot.mcpConfigurations[0].parameters = {
      kb_ids: [additionalKbId, originalKbId],
      required: true,
      toolAlias: 'doc_query',
    }
    mocks.findChatbot.mockResolvedValue(chatbot)

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ kbIds: [originalKbId, additionalKbId] })
    )
  })

  it('ignores a disabled KB scope beside an enabled configuration', async () => {
    const chatbot = createChatbot()
    const [enabledConfiguration] = chatbot.mcpConfigurations as Array<
      Record<string, unknown>
    >
    chatbot.mcpConfigurations = [
      enabledConfiguration,
      {
        ...enabledConfiguration,
        isEnabled: false,
        parameters: {
          ...(enabledConfiguration.parameters as Record<string, unknown>),
          kb_id: additionalKbId,
        },
        priority: 2,
      },
    ]
    mocks.findChatbot.mockResolvedValue(chatbot)

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ kbIds: [originalKbId] })
    )
  })

  it('does not create a KB scope from disabled-only configurations', async () => {
    const chatbot = createChatbot()
    const [configuration] = chatbot.mcpConfigurations as Array<
      Record<string, unknown>
    >
    chatbot.mcpConfigurations = [{ ...configuration, isEnabled: false }]
    mocks.findChatbot.mockResolvedValue(chatbot)

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ kbIds: undefined })
    )
  })

  it('rejects an unavailable saved model before opening MCP tools', async () => {
    mocks.getModelsForChatbot.mockReturnValue([])

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.closeMcpTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('keeps a fixed saved model and effort authoritative over client choices', async () => {
    setRequestOptions({
      reasoningEffort: 'high',
      selectedMode: 'tutor',
      selectedModel: 'advanced-model',
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getChatModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'base-model' })
    )
    const streamOptions = mocks.streamText.mock.calls[0]![0]
    expect(streamOptions.providerOptions.openai).not.toHaveProperty(
      'reasoningEffort'
    )
  })

  it('accepts an allow-listed model and reasoning effort in participant-choice mode', async () => {
    const reasoningModel = {
      ...baseModel,
      cost: { input: 1, output: 2 },
      deploymentId: 'student-model',
      fallback: false,
      id: 'student-model',
      name: 'Student model',
      supportsReasoning: true,
      supportedReasoningEfforts: ['medium'],
      usageClass: 'ADVANCED',
    }
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        allowedModelIds: ['student-model'],
        modelSelection: true,
      })
    )
    mocks.getModelsForChatbot.mockReturnValue([reasoningModel])
    mocks.getAutomaticModelId.mockReturnValue('student-model')
    setRequestOptions({
      reasoningEffort: 'medium',
      selectedMode: 'tutor',
      selectedModel: 'student-model',
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getChatModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'student-model' })
    )
    const streamOptions = mocks.streamText.mock.calls[0]![0]
    expect(streamOptions.providerOptions.openai).toMatchObject({
      reasoningEffort: 'medium',
      reasoningSummary: 'auto',
    })
  })

  it.each([
    { selectedModel: 'not-allowed-model', reasoningEffort: 'medium' },
    { selectedModel: 'student-model', reasoningEffort: 'high' },
  ])('rejects unavailable selections %j before opening MCP tools', async (options) => {
    const reasoningModel = {
      ...baseModel,
      id: 'student-model',
      name: 'Student model',
      supportsReasoning: true,
      supportedReasoningEfforts: ['medium'],
      usageClass: 'ADVANCED',
    }
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        allowedModelIds: ['student-model'],
        modelSelection: true,
      })
    )
    mocks.getModelsForChatbot.mockReturnValue([reasoningModel])
    mocks.getAutomaticModelId.mockReturnValue('student-model')
    setRequestOptions({
      selectedMode: 'tutor',
      ...options,
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('rejects attachments before model or MCP work', async () => {
    const messagesWithAttachment = [
      {
        id: 'user-message',
        parts: [{ type: 'file' as const, url: 'data:image/png;base64,AA==' }],
        role: 'user' as const,
      },
    ]
    mocks.readBoundedJson.mockResolvedValue({
      ok: true,
      value: {
        messages: messagesWithAttachment,
        selectedMode: 'tutor',
      },
    })
    mocks.validateManageChatRequest.mockResolvedValue({
      messages: messagesWithAttachment,
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.findChatbot).not.toHaveBeenCalled()
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('rejects an unsupported mode before MCP or model work', async () => {
    mocks.readBoundedJson.mockResolvedValue({
      ok: true,
      value: { messages: uiMessages, selectedMode: 'exam' },
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('uses saved standard mode availability before MCP or model work', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        standardModeConfig: {
          ...defaultStandardModeConfig,
          explainerEnabled: true,
          tutorEnabled: false,
        },
        systemPrompts: {
          explainer: 'Explainer instructions',
          tutor: 'Tutor instructions',
        },
      })
    )
    setRequestOptions({ selectedMode: 'tutor' })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.getModelsForChatbot).not.toHaveBeenCalled()
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
  })

  it('does not inherit a disabled exact Quizzer MCP row from Tutor', async () => {
    const tutorConfiguration = {
      allowedTools: ['doc_query'],
      chatMode: 'tutor',
      isEnabled: true,
      parameters: {
        kb_id: originalKbId,
        required: true,
        toolAlias: 'doc_query',
      },
      priority: 1,
      mcpServer: {
        authSecret: null,
        authType: 'scope_token',
        chatbotIdHeader: null,
        id: 'kb-server',
        isActive: true,
        name: 'KB',
        parameters: {},
        passChatbotId: false,
        url: 'http://kb.test/mcp',
      },
    }
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        mcpConfigurations: [
          tutorConfiguration,
          { ...tutorConfiguration, chatMode: 'quizzer', isEnabled: false },
        ],
        standardModeConfig: {
          ...defaultStandardModeConfig,
          quizzerEnabled: true,
        },
        systemPrompts: {
          quizzer: 'Quizzer instructions',
          tutor: 'Tutor instructions',
        },
      })
    )
    setRequestOptions({ selectedMode: 'quizzer' })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
  })

  it.each([
    true,
    false,
  ])('requires document query for Quizzer when discovery availability is %s', async (available) => {
    const tutorConfiguration = {
      allowedTools: ['doc_query'],
      chatMode: 'tutor',
      isEnabled: true,
      parameters: {
        kb_id: originalKbId,
        required: true,
        toolAlias: 'doc_query',
      },
      priority: 1,
      mcpServer: {
        authSecret: null,
        authType: 'scope_token',
        chatbotIdHeader: null,
        id: 'kb-server',
        isActive: true,
        name: 'KB',
        parameters: {},
        passChatbotId: false,
        url: 'http://kb.test/mcp',
      },
    }
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        mcpConfigurations: [tutorConfiguration],
        standardModeConfig: {
          ...defaultStandardModeConfig,
          quizzerEnabled: true,
        },
        systemPrompts: {
          quizzer: 'Quizzer instructions',
          tutor: 'Tutor instructions',
        },
      })
    )
    setRequestOptions({ selectedMode: 'quizzer' })
    if (!available) {
      mocks.getAggregatedMCPTools.mockResolvedValue({
        close: mocks.closeMcpTools,
        tools: {},
      })
    }

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    if (!available) {
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({
        code: 'REQUIRED_MCP_UNAVAILABLE',
      })
      expect(mocks.closeMcpTools).toHaveBeenCalledOnce()
      expect(mocks.streamText).not.toHaveBeenCalled()
      return
    }

    expect(response.status).toBe(200)
    const streamOptions = mocks.streamText.mock.calls[0]![0]
    expect(streamOptions.prepareStep({ stepNumber: 0 })).toEqual({
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
    expect(streamOptions.prepareStep({ stepNumber: 1 })).toEqual({})
  })
})
