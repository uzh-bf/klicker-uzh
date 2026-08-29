import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  checkDisclaimerStatus: vi.fn(),
  findUnique: vi.fn(),
  findThread: vi.fn(),
  findMessages: vi.fn(),
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
    chatMessage: {
      findMany: mocks.findMessages,
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

import { POST } from '../src/app/api/chatbots/[chatbotId]/chat/route'
import {
  REQUIRED_MCP_UNAVAILABLE_CODE,
  RequiredMCPUnavailableError,
} from '../src/lib/server/mcpRuntimePolicy'

function createRequest(selectedMode?: string, threadId?: string) {
  return new NextRequest('http://localhost/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { id: 'message-1', role: 'user', content: 'Find the relevant video.' },
      ],
      selectedModel: 'gpt-4.1',
      ...(selectedMode ? { selectedMode } : {}),
      ...(threadId ? { threadId } : {}),
      assistantMessageId: 'assistant-1',
    }),
  })
}

describe('required MCP chat preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({
      participantId: 'participant-1',
      authMode: 'account',
      chatbot: { courseId: 'course-1' },
    })
    mocks.checkDisclaimerStatus.mockResolvedValue({
      required: false,
      accepted: true,
    })
    mocks.isChatAccountUsageAvailable.mockResolvedValue(true)
    mocks.isChatAccountUsageEnforcementEnabled.mockReturnValue(true)
    mocks.previewUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.getUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.createThread.mockResolvedValue({ id: 'thread-1' })
    mocks.findFailedTurnThreadId.mockResolvedValue(null)
    mocks.deleteThread.mockResolvedValue(true)
    mocks.findThread.mockResolvedValue({ id: 'thread-1' })
    mocks.findMessages.mockResolvedValue([])
    mocks.claimChatTurn.mockResolvedValue({
      outcome: 'claimed',
      lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
    })
    mocks.failChatTurn.mockResolvedValue(undefined)
    mocks.findUnique.mockResolvedValue({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: { tutor: { prompt: 'Use course material.' } },
      knowledgeBases: [],
      mcpConfigurations: [
        {
          chatMode: 'tutor',
          isEnabled: true,
          priority: 0,
          allowedTools: ['informatik_und_wirtschaft_video_expert'],
          parameters: { required: true, toolAlias: 'doc_query' },
          mcpServer: {
            id: 'server-1',
            name: 'IW',
            url: 'https://mcp.example.test',
            authType: 'none',
            authSecret: null,
            parameters: null,
            isActive: false,
            passChatbotId: false,
            chatbotIdHeader: null,
          },
        },
      ],
    })
    mocks.getAggregatedMCPTools.mockRejectedValue(
      new RequiredMCPUnavailableError()
    )
  })

  test('refuses a thread id the caller does not own before MCP work', async () => {
    mocks.findThread.mockResolvedValueOnce(null)

    const response = await POST(createRequest(undefined, 'thread-foreign'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Chat thread not found',
    })
    expect(mocks.findThread).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'thread-foreign',
          participantId: 'participant-1',
          chatbotId: 'chatbot-1',
        },
      })
    )
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.createThread).not.toHaveBeenCalled()
  })

  test('scopes MCP discovery to an owned thread id', async () => {
    mocks.findThread.mockResolvedValueOnce({ id: 'thread-owned' })

    const response = await POST(createRequest(undefined, 'thread-owned'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sessionId: 'thread-owned' })
    )
  })

  test('discards the transient claim and forwards inactive required configs', async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Required MCP tool unavailable',
      code: REQUIRED_MCP_UNAVAILABLE_CODE,
    })
    expect(mocks.isChatAccountUsageAvailable).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      usageClass: 'ADVANCED',
    })
    expect(mocks.previewUserCredits).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1'
    )
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          server: expect.objectContaining({ isActive: false }),
        }),
      ],
      {
        chatbotId: 'chatbot-1',
        participantId: 'participant-1',
        authMode: 'account',
        kbId: undefined,
        sessionId: 'thread-1',
      }
    )
    expect(mocks.getUserCredits).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1'
    )
    expect(mocks.createThread).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1',
      null
    )
    expect(mocks.claimChatTurn).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      chatbotId: 'chatbot-1',
      threadId: 'thread-1',
      assistantMessageId: 'assistant-1',
      parentId: 'message-1',
    })
    expect(mocks.failChatTurn).not.toHaveBeenCalled()
    expect(mocks.deleteThread).toHaveBeenCalledWith(
      'thread-1',
      'participant-1',
      'chatbot-1'
    )
  })

  test('fails the claim after transient thread cleanup fails', async () => {
    let finishDeletion: (deleted: boolean) => void = () => {}
    mocks.deleteThread.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finishDeletion = resolve
      })
    )

    const responsePromise = POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    await vi.waitFor(() => expect(mocks.deleteThread).toHaveBeenCalledOnce())
    expect(mocks.failChatTurn).not.toHaveBeenCalled()
    finishDeletion(false)

    const response = await responsePromise
    expect(response.status).toBe(503)
    expect(mocks.failChatTurn).toHaveBeenCalledWith({
      assistantMessageId: 'assistant-1',
      threadId: 'thread-1',
      lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
    })
    expect(mocks.deleteThread.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.failChatTurn.mock.invocationCallOrder[0]!
    )
  })

  test('rejects an unsupported mode before MCP and thread work', async () => {
    const response = await POST(createRequest('unsupported'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported chat mode: unsupported',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.createThread).not.toHaveBeenCalled()
  })

  test('hides a mode without its required MCP binding', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: {
        tutor: { prompt: 'Use course material.' },
        explainer: { prompt: 'Explain course material.' },
      },
      knowledgeBases: [],
      mcpConfigurations: [
        {
          chatMode: 'explainer',
          isEnabled: true,
          parameters: { required: true, toolAlias: 'doc_query' },
        },
      ],
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported chat mode: tutor',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.createThread).not.toHaveBeenCalled()
  })

  test('forwards an inherited required document-query binding for Quizzer', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: {
        tutor: { prompt: 'Use course material.' },
        quizzer: { prompt: 'Ask course questions.' },
      },
      mcpConfigurations: [
        {
          chatMode: 'tutor',
          isEnabled: true,
          priority: 0,
          allowedTools: ['informatik_und_wirtschaft_video_expert'],
          parameters: { required: true, toolAlias: 'doc_query' },
          mcpServer: {
            id: 'server-1',
            name: 'IW',
            url: 'https://mcp.example.test',
            authType: 'none',
            authSecret: null,
            parameters: null,
            isActive: false,
            passChatbotId: false,
            chatbotIdHeader: null,
          },
        },
      ],
    })

    const response = await POST(createRequest('quizzer'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          config: expect.objectContaining({
            allowedTools: ['informatik_und_wirtschaft_video_expert'],
            parameters: { required: true, toolAlias: 'doc_query' },
          }),
        }),
      ],
      'chatbot-1'
    )
  })

  test('rejects Quizzer when Tutor only has a wildcard tool binding', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: {
        tutor: { prompt: 'Use course material.' },
        quizzer: { prompt: 'Ask course questions.' },
      },
      mcpConfigurations: [
        {
          chatMode: 'tutor',
          isEnabled: true,
          priority: 0,
          allowedTools: ['*'],
          parameters: null,
          mcpServer: { id: 'server-1' },
        },
      ],
    })

    const response = await POST(createRequest('quizzer'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported chat mode: quizzer',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.createThread).not.toHaveBeenCalled()
  })

  test('preserves the exact key for a mixed-case custom mode', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: {
        QuickCheck: { prompt: 'Ask one brief question.' },
      },
      mcpConfigurations: [
        {
          chatMode: 'QuickCheck',
          isEnabled: true,
          priority: 0,
          allowedTools: ['course_search'],
          parameters: { required: true, toolAlias: 'doc_query' },
          mcpServer: {
            id: 'server-1',
            name: 'Course',
            url: 'https://mcp.example.test',
            authType: 'none',
            authSecret: null,
            parameters: null,
            isActive: false,
            passChatbotId: false,
            chatbotIdHeader: null,
          },
        },
      ],
    })

    const response = await POST(createRequest('QuickCheck'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          server: expect.objectContaining({ id: 'server-1' }),
        }),
      ],
      'chatbot-1'
    )
  })
})
