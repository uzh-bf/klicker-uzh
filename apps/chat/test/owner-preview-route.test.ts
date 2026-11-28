import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type ChatModeMCPConfiguration,
  resolveEffectiveChatModeOptions,
  resolveRequestedChatMode,
} from '@/src/lib/server/effectiveChatModes'
import { REPLY_LANGUAGE_REMINDER } from '@/src/lib/server/languageInstructions'

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
  findKbServer: vi.fn(),
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
    chatbotMCPServer: { findUnique: mocks.findKbServer },
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

const originalKbId = '11111111-1111-4111-8111-111111111111'
const additionalKbId = '22222222-2222-4222-8222-222222222222'

const originalLinkId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const additionalLinkId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

// Mirrors the managed-link rows the preview route now selects.
function kbLink(
  id: string,
  kbId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    kbId,
    isEnabled: true,
    isDefault: false,
    kb: {
      deletedAt: null,
      ownerId: 'owner-id',
      name: `KB ${kbId.slice(0, 2)}`,
      knowledgeGraphEnabled: false,
    },
    ...overrides,
  }
}

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
  writingCoachEnabled: false,
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
    knowledgeBases: [kbLink(originalLinkId, originalKbId, { isDefault: true })],
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
    owner: {
      aiFeaturesEnabled: true,
      aiSubscriptionTier: 'ADVANCED',
      aiChatbotCostCenter: 'KST-1',
    },
    ownerId: 'owner-id',
    standardModeConfig: defaultStandardModeConfig,
    customModeConfig: null,
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

function createCustomModeChatbot() {
  const [tutorConfiguration] = createChatbot().mcpConfigurations as Array<
    Record<string, unknown>
  >

  return createChatbot({
    mcpConfigurations: [
      tutorConfiguration,
      {
        ...tutorConfiguration,
        chatMode: 'Ethik-Rollenspiel',
        priority: 2,
      },
    ],
    systemPrompts: {
      'Ethik-Rollenspiel': 'Ethik instructions',
      tutor: 'Tutor instructions',
    },
  })
}

const approvedCustomMode = {
  key: 'cm_11111111-1111-4111-8111-111111111111',
  name: 'Ethik-Rollenspiel',
  description: 'Practises ethical reasoning in a role play.',
  personaText: 'Act as the role-play counterpart.',
}

function createApprovedCustomModeChatbot() {
  const [tutorConfiguration] = createChatbot().mcpConfigurations as Array<
    Record<string, unknown>
  >

  return createChatbot({
    customModeConfig: { modes: [approvedCustomMode] },
    mcpConfigurations: [
      tutorConfiguration,
      {
        ...tutorConfiguration,
        chatMode: approvedCustomMode.key,
        priority: 2,
      },
    ],
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
    mocks.findKbServer.mockResolvedValue({
      authSecret: null,
      authType: 'scope_token',
      chatbotIdHeader: null,
      id: 'kb-server',
      isActive: true,
      name: 'KB',
      parameters: {},
      passChatbotId: false,
      url: 'http://kb.test/mcp',
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

  it.each([
    [false, true, 'balanced', 'neutral'],
    [true, false, 'bullets', 'direct'],
    [undefined, true, 'bullets', 'direct'],
  ])('uses the saved answer-preference flag with a live fallback', async (saved, live, style, tone) => {
    mocks.findChatbot.mockResolvedValueOnce(
      createChatbot({
        answerPreferencesEnabled: live,
        draftConfig: { answerPreferencesEnabled: saved },
      })
    )
    setRequestOptions({ answerStyle: 'bullets', answerTone: 'direct' })
    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    expect(response.status).toBe(200)
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      'tutor',
      expect.objectContaining({ answerStyle: style, answerTone: tone })
    )
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

  it.each([
    ['without a cost center', 'ADVANCED', null],
    ['on the base tier', 'BASE', 'KST-1'],
  ] as const)('refuses an advanced model for an account %s', async (_case, aiSubscriptionTier, aiChatbotCostCenter) => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        modelSelection: true,
        owner: {
          aiFeaturesEnabled: true,
          aiSubscriptionTier,
          aiChatbotCostCenter,
        },
      })
    )
    setRequestOptions({
      selectedMode: 'tutor',
      selectedModel: 'advanced-model',
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat model usage is unavailable',
      code: 'CHAT_MODEL_UNAVAILABLE_ADVANCED',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('still previews a base model without a cost center', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        owner: {
          aiFeaturesEnabled: true,
          aiSubscriptionTier: 'BASE',
          aiChatbotCostCenter: null,
        },
      })
    )

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.streamText).toHaveBeenCalledOnce()
  })

  it('refuses a base model for an account without AI approval', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        owner: {
          aiFeaturesEnabled: false,
          aiSubscriptionTier: 'ADVANCED',
          aiChatbotCostCenter: 'KST-1',
        },
      })
    )

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Account AI approval is required for preview',
    })
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
        ownerPreviewUserId: 'owner-id',
        kbIds: [originalKbId],
      })
    )
    expect(mocks.getAggregatedMCPTools.mock.calls[0]?.[1]).not.toHaveProperty(
      'participantId'
    )
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ tutor: 'Tutor instructions' }),
      'tutor',
      {
        courseDisplayName: 'Test Course',
        answerStyle: 'balanced',
        answerTone: 'neutral',
        customModeConfig: null,
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
        kbId: originalKbId,
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

  it('preserves a configured tool when its name conflicts with the example skill', async () => {
    const configuredTool = { execute: vi.fn() }
    mocks.getAggregatedMCPTools.mockResolvedValue({
      close: mocks.closeMcpTools,
      tools: { KB_doc_query: {}, search_response_examples: configuredTool },
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: 'Compiled prompt',
        tools: expect.objectContaining({
          search_response_examples: configuredTool,
        }),
      })
    )
    expect(mocks.createResponseExampleSearchTool).not.toHaveBeenCalled()
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
            select: expect.objectContaining({
              id: true,
              kbId: true,
              isEnabled: true,
              isDefault: true,
            }),
            orderBy: { id: 'asc' },
          },
        }),
      })
    )
    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        kbId: originalKbId,
        kbLinkId: originalLinkId,
      })
    )
  })

  it('withholds the receipt KB scope for a chatbot without managed links', async () => {
    const chatbot = await mocks.findChatbot()
    mocks.findChatbot.mockResolvedValue({ ...chatbot, knowledgeBases: [] })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: undefined, kbLinkId: undefined })
    )
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        kbIds: [originalKbId],
      })
    )
  })

  it('revalidates a legacy preview-only mode before issuing a credential', async () => {
    const legacy = createChatbot({
      systemPrompts: { 'case-lab': { prompt: 'Discuss a case' } },
      mcpConfigurations: (
        createChatbot().mcpConfigurations as Array<Record<string, unknown>>
      ).map((row) => ({ ...row, allowedTools: ['doc_query'] })),
    })
    mocks.findChatbot.mockResolvedValue(legacy)
    setRequestOptions({ selectedMode: 'case-lab' })
    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    expect(response.status).toBe(200)
    const options = mocks.getAggregatedMCPTools.mock.calls.at(-1)![1]
    await expect(
      options.revalidateKnowledgeBaseScope()
    ).resolves.toBeUndefined()
    mocks.findChatbot.mockResolvedValue({ ...legacy, systemPrompts: {} })
    await expect(options.revalidateKnowledgeBaseScope()).rejects.toThrow()
  })

  it('follows the live default link over a stale legacy KB binding', async () => {
    const chatbot = await mocks.findChatbot()
    mocks.findChatbot.mockResolvedValue({
      ...chatbot,
      knowledgeBases: [
        kbLink(originalLinkId, originalKbId),
        kbLink(additionalLinkId, additionalKbId, { isDefault: true }),
      ],
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          config: expect.objectContaining({
            parameters: expect.objectContaining({ kb_id: additionalKbId }),
          }),
        }),
      ],
      expect.objectContaining({
        kbIds: [additionalKbId],
        kbLinkId: additionalLinkId,
      })
    )
    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        kbId: additionalKbId,
        kbLinkId: additionalLinkId,
      })
    )
  })

  it('does not search any source when links exist but none is the default', async () => {
    const chatbot = await mocks.findChatbot()
    mocks.findChatbot.mockResolvedValue({
      ...chatbot,
      knowledgeBases: [
        kbLink(originalLinkId, originalKbId),
        kbLink(additionalLinkId, additionalKbId),
      ],
    })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: undefined, kbLinkId: undefined })
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

  it('uses the configured multi-KB scope on a chatbot without managed links', async () => {
    const chatbot = await mocks.findChatbot()
    chatbot.knowledgeBases = []
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
    await response.text()
    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: undefined })
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
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
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

  it.each([
    {
      resolvedMode: 'Ethik-Rollenspiel',
      selectedMode: 'Ethik-Rollenspiel',
      status: 200,
    },
    {
      resolvedMode: 'ethik-rollenspiel',
      selectedMode: 'ethik-rollenspiel',
      status: 400,
    },
    {
      resolvedMode: 'tutor',
      selectedMode: 'Tutor',
      status: 200,
    },
    {
      resolvedMode: 'tutor',
      selectedMode: 'TUTOR',
      status: 200,
    },
  ])('resolves $selectedMode against the preview mode options', async ({
    selectedMode,
    resolvedMode,
    status,
  }) => {
    const chatbot = createCustomModeChatbot()
    mocks.findChatbot.mockResolvedValue(chatbot)

    const modeOptions = resolveEffectiveChatModeOptions(
      chatbot.systemPrompts,
      chatbot.mcpConfigurations as ChatModeMCPConfiguration[],
      chatbot.standardModeConfig,
      {
        allowUnapprovedModes: true,
        customModeConfig: chatbot.customModeConfig,
      }
    )
    expect(Object.hasOwn(modeOptions, 'Ethik-Rollenspiel')).toBe(true)
    expect(resolveRequestedChatMode(modeOptions, selectedMode)).toBe(
      resolvedMode
    )

    setRequestOptions({ selectedMode })
    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(status)
    if (status === 400) {
      expect(await response.json()).toEqual({
        error: 'Unsupported chat mode: ethik-rollenspiel',
      })
      expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
      expect(mocks.streamText).not.toHaveBeenCalled()
      return
    }

    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        'Ethik-Rollenspiel': 'Ethik instructions',
        tutor: 'Tutor instructions',
      }),
      resolvedMode,
      {
        courseDisplayName: 'Test Course',
        answerStyle: 'balanced',
        answerTone: 'neutral',
        customModeConfig: null,
        toolNames: ['KB_doc_query', 'search_response_examples'],
        standardModeConfig: defaultStandardModeConfig,
      }
    )
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ kbIds: [originalKbId] })
    )
  })

  it('previews an approved custom mode by its stored key and compiles its persona', async () => {
    const chatbot = createApprovedCustomModeChatbot()
    mocks.findChatbot.mockResolvedValue(chatbot)

    const modeOptions = resolveEffectiveChatModeOptions(
      chatbot.systemPrompts,
      chatbot.mcpConfigurations as ChatModeMCPConfiguration[],
      chatbot.standardModeConfig,
      {
        allowUnapprovedModes: true,
        customModeConfig: chatbot.customModeConfig,
      }
    )
    expect(modeOptions[approvedCustomMode.key]).toEqual({
      description: approvedCustomMode.description,
      name: approvedCustomMode.name,
    })

    setRequestOptions({ selectedMode: approvedCustomMode.key })
    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      { tutor: 'Tutor instructions' },
      approvedCustomMode.key,
      {
        courseDisplayName: 'Test Course',
        answerStyle: 'balanced',
        answerTone: 'neutral',
        customModeConfig: { modes: [approvedCustomMode] },
        toolNames: ['KB_doc_query', 'search_response_examples'],
        standardModeConfig: defaultStandardModeConfig,
      }
    )
    // The owner keeps seeing reasoning for a custom mode that hides it from
    // participants by default.
    const stream = mocks.streamText.mock.results[0]?.value as {
      toUIMessageStream: ReturnType<typeof vi.fn>
    }
    expect(stream.toUIMessageStream).toHaveBeenCalledWith(
      expect.objectContaining({ sendReasoning: true })
    )
    await response.text()
    expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        chatMode: approvedCustomMode.key,
        kbId: undefined,
      })
    )
  })

  it('previews a draft custom mode through the saved revision even when the live config is empty', async () => {
    const chatbot = createChatbot({
      mcpConfigurations: [
        {
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
        },
      ],
      draftConfig: {
        ...createApprovedCustomModeChatbot(),
        customModeConfig: { modes: [approvedCustomMode] },
      },
    })
    mocks.findChatbot.mockResolvedValue(chatbot)

    const modeOptions = resolveEffectiveChatModeOptions(
      chatbot.systemPrompts,
      chatbot.mcpConfigurations as ChatModeMCPConfiguration[],
      chatbot.standardModeConfig,
      {
        allowUnapprovedModes: true,
        customModeConfig: (chatbot.draftConfig as Record<string, unknown>)
          .customModeConfig,
      }
    )
    expect(modeOptions[approvedCustomMode.key]).toEqual({
      description: approvedCustomMode.description,
      name: approvedCustomMode.name,
    })

    setRequestOptions({ selectedMode: approvedCustomMode.key })
    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ kbIds: [originalKbId] })
    )
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      { tutor: 'Tutor instructions' },
      approvedCustomMode.key,
      {
        courseDisplayName: 'Test Course',
        answerStyle: 'balanced',
        answerTone: 'neutral',
        customModeConfig: { modes: [approvedCustomMode] },
        toolNames: ['KB_doc_query', 'search_response_examples'],
        standardModeConfig: defaultStandardModeConfig,
      }
    )
  })

  it('defaults an omitted preview request to the saved custom-only mode', async () => {
    const savedStandardModeConfig = {
      ...defaultStandardModeConfig,
      tutorEnabled: false,
      explicitModeSelection: true,
    }
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        customModeConfig: null,
        draftConfig: {
          customModeConfig: { modes: [approvedCustomMode] },
          standardModeConfig: savedStandardModeConfig,
        },
      })
    )
    setRequestOptions({})

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      approvedCustomMode.key,
      expect.objectContaining({
        customModeConfig: { modes: [approvedCustomMode] },
        standardModeConfig: savedStandardModeConfig,
      })
    )
  })

  it('rejects a zero-mode preview before model or tool work', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        draftConfig: {
          customModeConfig: { modes: [] },
          standardModeConfig: {
            ...defaultStandardModeConfig,
            tutorEnabled: false,
            explicitModeSelection: true,
          },
        },
      })
    )
    setRequestOptions({})

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No chat mode is available',
    })
    expect(mocks.getModelsForChatbot).not.toHaveBeenCalled()
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['explicit null', null],
  ])('applies the saved revision when custom modes are %s', async (_label, savedCustomModes) => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        customModeConfig: { modes: [approvedCustomMode] },
        draftConfig:
          savedCustomModes === undefined
            ? { answerPreferencesEnabled: true }
            : { customModeConfig: savedCustomModes },
      })
    )
    setRequestOptions({ selectedMode: approvedCustomMode.key })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(savedCustomModes === undefined ? 200 : 400)
  })

  it('uses saved standard mode availability before MCP or model work', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        draftConfig: {
          standardModeConfig: {
            ...defaultStandardModeConfig,
            explainerEnabled: true,
            tutorEnabled: false,
          },
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

  it('treats an explicit null standard-mode snapshot as legacy defaults', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        draftConfig: { standardModeConfig: null },
        standardModeConfig: {
          ...defaultStandardModeConfig,
          tutorEnabled: false,
          explicitModeSelection: true,
        },
      })
    )
    setRequestOptions({})

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      'tutor',
      expect.objectContaining({ standardModeConfig: null })
    )
  })

  it('previews a disabled exact Quizzer binding as knowledge-base-free practice', async () => {
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

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      'quizzer',
      expect.objectContaining({
        toolNames: expect.not.arrayContaining(['KB_doc_query']),
      })
    )
    const streamOptions = mocks.streamText.mock.calls[0]![0]
    expect(
      streamOptions.prepareStep({
        initialMessages: [],
        responseMessages: [],
        stepNumber: 0,
        steps: [],
      })
    ).toEqual({ messages: [REPLY_LANGUAGE_REMINDER] })
  })

  it('rejects missing KB scope even when the tool allow-list excludes document query', async () => {
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        mcpConfigurations: [
          {
            ...(
              createChatbot().mcpConfigurations as Array<
                Record<string, unknown>
              >
            )[0],
            allowedTools: ['course_outline'],
            parameters: null,
          },
        ],
        standardModeConfig: {
          ...defaultStandardModeConfig,
          quizzerEnabled: true,
        },
      })
    )
    setRequestOptions({ selectedMode: 'quizzer' })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  it('preserves the raw name behind a supported document-query alias', async () => {
    const tutorConfiguration = {
      ...(
        createChatbot().mcpConfigurations as Array<Record<string, unknown>>
      )[0],
      allowedTools: ['course_search'],
      parameters: {
        kb_id: originalKbId,
        required: true,
        toolAlias: 'doc_query',
      },
    }
    mocks.findChatbot.mockResolvedValue(
      createChatbot({
        mcpConfigurations: [tutorConfiguration],
        standardModeConfig: {
          ...defaultStandardModeConfig,
          quizzerEnabled: true,
        },
      })
    )
    mocks.getAggregatedMCPTools.mockResolvedValue({
      close: mocks.closeMcpTools,
      tools: { KB_doc_query: { description: 'Search course material' } },
    })
    setRequestOptions({ selectedMode: 'quizzer' })

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          config: expect.objectContaining({
            allowedTools: ['course_search'],
            parameters: tutorConfiguration.parameters,
          }),
        }),
      ],
      expect.anything()
    )
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
    expect(
      streamOptions.prepareStep({
        initialMessages: [],
        responseMessages: [],
        stepNumber: 0,
        steps: [],
      })
    ).toEqual({
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
      messages: [REPLY_LANGUAGE_REMINDER],
    })
    expect(
      streamOptions.prepareStep({
        initialMessages: [],
        responseMessages: [],
        stepNumber: 1,
        steps: [],
      })
    ).toEqual({ messages: [REPLY_LANGUAGE_REMINDER] })
  })

  it('projects canonical citation indices into the preview continuation', async () => {
    const raw = {
      mode: 'documents',
      sources: [
        {
          chunks: [{ content: 'Passage', page_number: 1 }],
          reference: 'urn:source:a',
          title: 'Material',
        },
      ],
    }
    const steps = [
      {
        content: [
          {
            input: {},
            toolCallId: 'call-1',
            toolName: 'KB_doc_query',
            type: 'tool-call',
          },
          {
            output: raw,
            toolCallId: 'call-1',
            toolName: 'KB_doc_query',
            type: 'tool-result',
          },
        ],
      },
    ]
    const responseMessages = [
      {
        content: [
          {
            output: { type: 'text', value: JSON.stringify(raw) },
            toolCallId: 'call-1',
            toolName: 'KB_doc_query',
            type: 'tool-result',
          },
        ],
        role: 'tool',
      },
    ]

    const response = await POST(request(), {
      params: Promise.resolve({ chatbotId: 'chatbot-id' }),
    })

    expect(response.status).toBe(200)
    const streamOptions = mocks.streamText.mock.calls[0]![0]
    const prepared = streamOptions.prepareStep({
      initialMessages: [{ role: 'user' }],
      responseMessages,
      stepNumber: 1,
      steps,
    })

    expect(prepared.messages).toHaveLength(3)
    expect(
      JSON.parse(prepared.messages[1].content[0].output.value).sources[0]
        .citation_index
    ).toBe(1)
    // Retrieved passages may be in another language than the question, so the
    // reply-language reminder must follow them as the step's last message.
    expect(prepared.messages[2]).toEqual(REPLY_LANGUAGE_REMINDER)
    expect(streamOptions.allowSystemInMessages).toBe(true)
  })

  describe('explicit mode sources', () => {
    const linkA = originalLinkId
    const linkB = additionalLinkId
    const modeKey = approvedCustomMode.key
    const explicitMode = (knowledgeBaseLinkId: string | null) => ({
      modes: [{ ...approvedCustomMode, knowledgeBaseLinkId }],
    })

    // A custom-only chatbot has no persisted MCP rows and no default link.
    function explicitChatbot(overrides: Record<string, unknown> = {}) {
      return createChatbot({
        mcpConfigurations: [],
        knowledgeBases: [
          kbLink(linkA, originalKbId),
          kbLink(linkB, additionalKbId),
        ],
        customModeConfig: explicitMode(linkA),
        ...overrides,
      })
    }

    async function preview() {
      setRequestOptions({ selectedMode: modeKey })
      const response = await POST(request(), {
        params: Promise.resolve({ chatbotId: 'chatbot-id' }),
      })
      // The body is consumed once here; callers assert on the returned text.
      const body = await response.text()
      return { response, body }
    }

    function expectNoProviderWork() {
      expect(mocks.findKbServer).not.toHaveBeenCalled()
      expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
      expect(mocks.getChatModel).not.toHaveBeenCalled()
      expect(mocks.streamText).not.toHaveBeenCalled()
    }

    it.each([
      ['A', linkA, originalKbId],
      ['B', linkB, additionalKbId],
    ])('sends exactly source %s with no persisted MCP rows', async (_label, linkId, kbId) => {
      mocks.findChatbot.mockResolvedValue(
        explicitChatbot({ customModeConfig: explicitMode(linkId) })
      )

      const { response } = await preview()

      expect(response.status).toBe(200)
      expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
      const [configurations, options] =
        mocks.getAggregatedMCPTools.mock.calls[0]!
      expect(configurations).toHaveLength(1)
      expect(configurations[0].config).toMatchObject({
        allowedTools: ['doc_query'],
        parameters: { kb_id: kbId, required: true, toolAlias: 'doc_query' },
      })
      expect(configurations[0].config.parameters).not.toHaveProperty('kb_ids')
      expect(options).toMatchObject({
        authMode: 'account',
        chatMode: modeKey,
        kbIds: [kbId],
        kbLinkId: linkId,
        ownerPreviewUserId: 'owner-id',
      })
      expect(options.revalidateKnowledgeBaseScope).toEqual(expect.any(Function))
      // Custom modes never qualify for response-example capture.
      expect(mocks.issuePreviewResponseExampleReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ kbId: undefined, kbLinkId: undefined })
      )
    })

    it.each([
      ['a nonexistent link', [kbLink(linkB, additionalKbId)]],
      ['a revoked link', [kbLink(linkA, originalKbId, { isEnabled: false })]],
      [
        'a soft-deleted source',
        [
          kbLink(linkA, originalKbId, {
            kb: { deletedAt: new Date(0), ownerId: 'owner-id' },
          }),
        ],
      ],
    ])('refuses %s before any provider or document work', async (_label, knowledgeBases) => {
      mocks.findChatbot.mockResolvedValue(explicitChatbot({ knowledgeBases }))

      const { response, body } = await preview()

      expect(response.status).toBe(503)
      expect(JSON.parse(body)).toMatchObject({
        code: 'REQUIRED_MCP_UNAVAILABLE',
      })
      expectNoProviderWork()
    })

    it('does not fall back to the default when the explicit source is gone', async () => {
      mocks.findChatbot.mockResolvedValue(
        explicitChatbot({
          knowledgeBases: [kbLink(linkB, additionalKbId, { isDefault: true })],
        })
      )

      const { response } = await preview()

      expect(response.status).toBe(503)
      expectNoProviderWork()
    })

    it('refuses an explicit source when the Doc Query server is unavailable', async () => {
      mocks.findKbServer.mockResolvedValue(null)
      mocks.findChatbot.mockResolvedValue(explicitChatbot())

      const { response } = await preview()

      expect(response.status).toBe(503)
      expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
      expect(mocks.streamText).not.toHaveBeenCalled()
    })

    it('previews the saved draft selection while the approved one stays unchanged', async () => {
      mocks.findChatbot.mockResolvedValue(
        explicitChatbot({
          customModeConfig: explicitMode(linkA),
          draftConfig: { customModeConfig: explicitMode(linkB) },
        })
      )

      const { response } = await preview()

      expect(response.status).toBe(200)
      expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            config: expect.objectContaining({
              parameters: expect.objectContaining({ kb_id: additionalKbId }),
            }),
          }),
        ],
        expect.objectContaining({ kbIds: [additionalKbId], kbLinkId: linkB })
      )
      // Published examples belong to the approved source, not the draft one.
      expect(mocks.loadResponseExampleRuntimeSkill).not.toHaveBeenCalled()
    })

    it('keeps published examples when the draft selects the approved source', async () => {
      mocks.findChatbot.mockResolvedValue(
        explicitChatbot({
          draftConfig: { customModeConfig: explicitMode(linkA) },
        })
      )

      const { response } = await preview()

      expect(response.status).toBe(200)
      expect(mocks.loadResponseExampleRuntimeSkill).toHaveBeenCalledWith(
        expect.objectContaining({ chatMode: modeKey })
      )
    })

    it('lets a draft explicitly inherit a source-free default', async () => {
      mocks.findChatbot.mockResolvedValue(
        explicitChatbot({
          draftConfig: { customModeConfig: explicitMode(null) },
        })
      )

      const { response } = await preview()

      expect(response.status).toBe(200)
      expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    })
  })
})
