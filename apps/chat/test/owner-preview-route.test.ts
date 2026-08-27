import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildPromptCacheRequest: vi.fn(),
  compileSystemPrompt: vi.fn(),
  convertToModelMessages: vi.fn(),
  createChatMessage: vi.fn(),
  createChatThread: vi.fn(),
  createParticipant: vi.fn(),
  findChatbot: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  getChatModel: vi.fn(),
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
      systemPrompts: { tutor: 'Tutor instructions' },
    })
    mocks.getAggregatedMCPTools.mockResolvedValue({
      KB_doc_query: { description: 'Search course material' },
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
    expect(mocks.streamText).toHaveBeenCalledOnce()
    expect(mocks.createChatMessage).not.toHaveBeenCalled()
    expect(mocks.createChatThread).not.toHaveBeenCalled()
    expect(mocks.createParticipant).not.toHaveBeenCalled()
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
