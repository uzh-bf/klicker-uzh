import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  checkDisclaimerStatus: vi.fn(),
  findUnique: vi.fn(),
  findThread: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  createThread: vi.fn(),
  findFailedTurnThreadId: vi.fn(),
  deleteThread: vi.fn(),
  previewUserCredits: vi.fn(),
  getUserCredits: vi.fn(),
  isChatAccountUsageEnforcementEnabled: vi.fn(),
  isChatAccountUsageAvailable: vi.fn(),
  claimChatTurn: vi.fn(),
  failChatTurn: vi.fn(),
  compileSystemPrompt: vi.fn(),
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
    chatbot: {
      findUnique: mocks.findUnique,
    },
    chatThread: {
      findFirst: mocks.findThread,
    },
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
  },
}))

vi.mock('@/src/services/accountUsage', () => ({
  CHAT_TURN_ALREADY_COMPLETED_CODE: 'CHAT_TURN_ALREADY_COMPLETED',
  ChatTurnConflictError: class ChatTurnConflictError extends Error {},
  claimChatTurn: mocks.claimChatTurn,
  failChatTurn: mocks.failChatTurn,
  finalizeChatTurn: vi.fn(),
  isChatAccountUsageEnforcementEnabled:
    mocks.isChatAccountUsageEnforcementEnabled,
  isChatAccountUsageAvailable: mocks.isChatAccountUsageAvailable,
  roundChatUsageCredits: (value: number) => ({ toNumber: () => value }),
}))

vi.mock('@/src/lib/server/systemPromptCompiler', () => ({
  compileSystemPrompt: mocks.compileSystemPrompt,
}))

// Every default model reads images, so the registry gains a text-only one.
vi.mock('@/src/lib/server/chatModelRegistry', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/lib/server/chatModelRegistry')>()
  const imageModel = actual.DEFAULT_MODEL_REGISTRY.find(
    (model) => model.id === 'gpt-4.1'
  )!
  return {
    ...actual,
    getChatModelRegistry: () => [
      ...actual.DEFAULT_MODEL_REGISTRY,
      {
        ...imageModel,
        id: 'text-only',
        deploymentId: 'text-only',
        supportsImageAttachments: false,
      },
    ],
  }
})

import { POST } from '../src/app/api/chatbots/[chatbotId]/chat/route'
import { RequiredMCPUnavailableError } from '../src/lib/server/mcpRuntimePolicy'

const JPEG_PAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='

function createRequest({
  selectedModel = 'gpt-4.1',
  documentPages,
}: {
  selectedModel?: string
  documentPages: string[]
}) {
  return new NextRequest('http://localhost/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { id: 'message-1', role: 'user', content: 'What does page 2 show?' },
      ],
      selectedModel,
      assistantMessageId: 'assistant-1',
      documentPages,
    }),
  })
}

const post = (request: NextRequest) =>
  POST(request, { params: Promise.resolve({ chatbotId: 'chatbot-1' }) })

describe('chat route document pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({ participantId: 'participant-1' })
    mocks.checkDisclaimerStatus.mockResolvedValue({
      required: false,
      accepted: true,
    })
    mocks.isChatAccountUsageAvailable.mockResolvedValue(true)
    mocks.isChatAccountUsageEnforcementEnabled.mockReturnValue(false)
    mocks.previewUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.getUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.findUnique.mockResolvedValue({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      owner: { aiFeaturesEnabled: true },
      allowedModelIds: ['gpt-4.1', 'text-only'],
      modelSelection: true,
      systemPrompts: { tutor: { prompt: 'Use course material.' } },
      standardModeConfig: null,
      mcpConfigurations: [
        {
          chatMode: 'tutor',
          isEnabled: true,
          priority: 0,
          allowedTools: ['doc_query'],
          parameters: { required: true },
          mcpServer: {
            id: 'server-1',
            name: 'KB',
            url: 'https://mcp.example.test',
            authType: 'none',
            authSecret: null,
            parameters: null,
            isActive: true,
            passChatbotId: false,
            chatbotIdHeader: null,
          },
        },
      ],
    })
    mocks.createThread.mockResolvedValue({ id: 'thread-1' })
    mocks.findFailedTurnThreadId.mockResolvedValue(null)
    mocks.deleteThread.mockResolvedValue(true)
    mocks.findThread.mockResolvedValue({ id: 'thread-1' })
    mocks.claimChatTurn.mockResolvedValue({
      outcome: 'claimed',
      lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
    })
    mocks.compileSystemPrompt.mockReturnValue('SYSTEM')
    // A required tool that is unavailable ends the request right after the
    // body and model checks, so reaching it means the pages were accepted.
    mocks.getAggregatedMCPTools.mockRejectedValue(
      new RequiredMCPUnavailableError()
    )
  })

  test('accepts up to ten JPEG pages for a model that reads images', async () => {
    const response = await post(
      createRequest({ documentPages: Array(10).fill(JPEG_PAGE) })
    )
    expect(response.status).toBe(503)
  })

  test('rejects more than ten pages', async () => {
    const response = await post(
      createRequest({ documentPages: Array(11).fill(JPEG_PAGE) })
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    })
  })

  test('rejects pages that are not JPEG data URLs', async () => {
    const response = await post(
      createRequest({
        documentPages: ['data:image/png;base64,iVBORw0KGgo='],
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects a page above the size cap', async () => {
    const response = await post(
      createRequest({
        documentPages: [`${JPEG_PAGE}${'A'.repeat(2_000_000)}`],
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects pages for a model that cannot read images', async () => {
    const response = await post(
      createRequest({
        selectedModel: 'text-only',
        documentPages: [JPEG_PAGE],
      })
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'DOCUMENT_PAGES_NOT_SUPPORTED',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
  })
})
