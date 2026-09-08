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
  createResponseExampleSearchTool: vi.fn(),
  findChatbot: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  getChatModel: vi.fn(),
  getAutomaticModelId: vi.fn(),
  getModelsForChatbot: vi.fn(),
  issuePreviewResponseExampleReceipt: vi.fn(),
  loadResponseExampleRuntimeSkill: vi.fn(),
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

vi.mock('@/src/lib/server/responseExampleReceipt', () => ({
  issuePreviewResponseExampleReceipt: mocks.issuePreviewResponseExampleReceipt,
  RESPONSE_EXAMPLE_RECEIPT_DATA_PART: 'data-response-example-receipt',
}))

vi.mock('@/src/lib/server/responseExampleRuntime', () => ({
  createResponseExampleSearchTool: mocks.createResponseExampleSearchTool,
  loadResponseExampleRuntimeSkill: mocks.loadResponseExampleRuntimeSkill,
  RESPONSE_EXAMPLE_SEARCH_TOOL_NAME: 'search_response_examples',
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
    knowledgeBases: [{ kbId: 'kb-id' }],
    mcpConfigurations: [
      {
        allowedTools: ['*', 'delete_all'],
        chatMode: 'tutor',
        isEnabled: true,
        parameters: {},
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
    mocks.issuePreviewResponseExampleReceipt.mockResolvedValue(null)
    mocks.loadResponseExampleRuntimeSkill.mockResolvedValue({
      projectionDigest: 'projection-digest',
      search: vi.fn(),
      setDigest: 'set-digest',
      summary: 'Use approved response examples when they fit.',
    })
    mocks.createResponseExampleSearchTool.mockReturnValue({
      description: 'Search approved response examples',
    })
    mocks.streamText.mockReturnValue({
      finishReason: Promise.resolve('stop'),
      toUIMessageStream: vi.fn().mockImplementation(
        ({ onEnd }) =>
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', messageId: 'assistant-1' })
              controller.enqueue({ type: 'text-start', id: 'text-1' })
              controller.enqueue({
                type: 'text-delta',
                id: 'text-1',
                delta: 'Grounded answer [1]',
              })
              controller.enqueue({ type: 'text-end', id: 'text-1' })
              onEnd?.({
                isAborted: false,
                responseMessage: {
                  id: 'assistant-1',
                  parts: [{ text: 'Grounded answer [1]', type: 'text' }],
                  role: 'assistant',
                },
              })
              controller.close()
            },
          })
      ),
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
    await response.text()

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
        kbIds: ['kb-id'],
      })
    )
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ tutor: 'Tutor instructions' }),
      'tutor',
      {
        courseDisplayName: 'Test Course',
        toolNames: ['KB_doc_query', 'search_response_examples'],
        standardModeConfig: defaultStandardModeConfig,
      }
    )
    expect(mocks.loadResponseExampleRuntimeSkill).toHaveBeenCalledWith({
      prisma: expect.anything(),
      chatbotId: 'chatbot-id',
      chatMode: 'tutor',
      role: 'included',
    })
    expect(mocks.streamText).toHaveBeenCalledOnce()
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions:
          'Compiled prompt\n\nUse approved response examples when they fit.',
        tools: expect.objectContaining({
          KB_doc_query: expect.anything(),
          search_response_examples: expect.anything(),
        }),
      })
    )
    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        chatbotId: 'chatbot-id',
        chatMode: 'tutor',
        finishReason: 'stop',
        kbId: 'kb-id',
        ownerId: 'owner-id',
      })
    )
    const streamOptions = mocks.streamText.mock.calls[0]![0]
    await streamOptions.onEnd()
    await streamOptions.onAbort()
    expect(mocks.closeMcpTools).toHaveBeenCalledOnce()
    expect(mocks.createChatMessage).not.toHaveBeenCalled()
    expect(mocks.createChatThread).not.toHaveBeenCalled()
    expect(mocks.createParticipant).not.toHaveBeenCalled()
  })

  it('rejects a standard mode disabled by the lecturer before model work', async () => {
    const chatbot = await mocks.findChatbot()
    mocks.findChatbot.mockResolvedValue({
      ...chatbot,
      standardModeConfig: {
        tutorEnabled: false,
        explainerEnabled: true,
        quizzerEnabled: false,
      },
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('passes authored standard-mode context into prompt compilation', async () => {
    const chatbot = await mocks.findChatbot()
    const standardModeConfig = {
      tutorEnabled: true,
      explainerEnabled: true,
      quizzerEnabled: false,
      courseName: 'Synthetic course',
      scopeNote: 'Synthetic scope',
    }
    mocks.findChatbot.mockResolvedValue({ ...chatbot, standardModeConfig })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      chatbot.systemPrompts,
      'tutor',
      expect.objectContaining({ standardModeConfig })
    )
  })

  it('continues without response examples when the included skill is unavailable', async () => {
    mocks.loadResponseExampleRuntimeSkill.mockRejectedValue(
      new Error('skill unavailable')
    )

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: 'Compiled prompt',
        tools: { KB_doc_query: expect.anything() },
      })
    )
    expect(mocks.createResponseExampleSearchTool).not.toHaveBeenCalled()
    expect(mocks.createChatMessage).not.toHaveBeenCalled()
    expect(mocks.createChatThread).not.toHaveBeenCalled()
    expect(mocks.createParticipant).not.toHaveBeenCalled()
  })

  it('appends an eligible receipt before the stream finishes', async () => {
    mocks.issuePreviewResponseExampleReceipt.mockResolvedValue({
      token: 'signed-receipt',
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    const body = await response.text()

    expect(body).toContain('data-response-example-receipt')
    expect(body).toContain('signed-receipt')
    expect(body.indexOf('data-response-example-receipt')).toBeLessThan(
      body.indexOf('"type":"finish"')
    )
    expect(mocks.findChatbot).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          knowledgeBases: {
            where: { isEnabled: true, kb: { deletedAt: null } },
            select: { kbId: true },
            take: 2,
          },
        }),
      })
    )
    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: 'kb-id' })
    )
  })

  it.each([
    { knowledgeBases: [] },
    { knowledgeBases: [{ kbId: 'first-kb' }, { kbId: 'second-kb' }] },
  ])('withholds the receipt KB scope without exactly one live binding: $knowledgeBases', async ({
    knowledgeBases,
  }) => {
    const chatbot = await mocks.findChatbot()
    mocks.findChatbot.mockResolvedValue({ ...chatbot, knowledgeBases })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: undefined })
    )
  })

  it('appends an unavailable capture state before the stream finishes', async () => {
    mocks.issuePreviewResponseExampleReceipt.mockResolvedValue({
      unavailable: true,
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    const body = await response.text()

    expect(body).toContain('data-response-example-receipt')
    expect(body).toContain('unavailable')
    expect(body.indexOf('data-response-example-receipt')).toBeLessThan(
      body.indexOf('"type":"finish"')
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
      parameters: {},
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
      parameters: {},
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
