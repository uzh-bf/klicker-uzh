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
  deploymentId: 'base-model',
  fallback: true,
  id: 'base-model',
  maxOutputTokens: 2048,
  usageClass: 'BASE',
  usesResponsesApi: true,
}

function request() {
  return new NextRequest(
    'https://chat.test/api/manage/chatbots/chatbot-id/preview/chat',
    { body: '{}', method: 'POST' }
  )
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
    mocks.findChatbot.mockResolvedValue({
      id: 'chatbot-id',
      course: { displayName: 'Test Course' },
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
      ownerId: 'owner-id',
      standardModeConfig: null,
      systemPrompts: { tutor: 'Tutor instructions' },
    })
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

  it('streams with the base model and exposes only doc_query from the KB server', async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.getChatModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chatbot-id' }),
      baseModel
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
        kbId: 'kb-id',
      })
    )
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ tutor: 'Tutor instructions' }),
      'tutor',
      {
        courseDisplayName: 'Test Course',
        toolNames: ['KB_doc_query', 'search_response_examples'],
        standardModeConfig: null,
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

  it('closes MCP tools when no base model is available', async () => {
    mocks.getModelsForChatbot.mockReturnValue([])

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.closeMcpTools).toHaveBeenCalledOnce()
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
})
