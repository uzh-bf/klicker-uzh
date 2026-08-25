import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  checkDisclaimerStatus: vi.fn(),
  findUnique: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  createThread: vi.fn(),
  getUserCredits: vi.fn(),
  isChatAccountUsageAvailable: vi.fn(),
  isChatTurnKeyClaimed: vi.fn(),
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
  },
}))

vi.mock('@/src/services/mcpClients', () => ({
  getAggregatedMCPTools: mocks.getAggregatedMCPTools,
}))

vi.mock('@/src/services/threads', () => ({
  ThreadService: {
    createThread: mocks.createThread,
  },
}))

vi.mock('@/src/services/credits', () => ({
  CreditsService: {
    getUserCredits: mocks.getUserCredits,
  },
}))

vi.mock('@/src/services/accountUsage', () => ({
  CHAT_TURN_ALREADY_COMPLETED_CODE: 'CHAT_TURN_ALREADY_COMPLETED',
  ChatTurnConflictError: class ChatTurnConflictError extends Error {},
  finalizeChatTurn: vi.fn(),
  isChatAccountUsageAvailable: mocks.isChatAccountUsageAvailable,
  isChatTurnKeyClaimed: mocks.isChatTurnKeyClaimed,
  roundChatUsageCredits: (value: number) => ({ toNumber: () => value }),
}))

import { POST } from '../src/app/api/chatbots/[chatbotId]/chat/route'
import {
  REQUIRED_MCP_UNAVAILABLE_CODE,
  RequiredMCPUnavailableError,
} from '../src/lib/server/mcpRuntimePolicy'

function createRequest(selectedMode?: string) {
  return new NextRequest('http://localhost/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { id: 'message-1', role: 'user', content: 'Find the relevant video.' },
      ],
      selectedModel: 'gpt-4.1',
      ...(selectedMode ? { selectedMode } : {}),
      assistantMessageId: 'assistant-1',
    }),
  })
}

describe('required MCP chat preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withChatbotAuth.mockResolvedValue({ participantId: 'participant-1' })
    mocks.checkDisclaimerStatus.mockResolvedValue({
      required: false,
      accepted: true,
    })
    mocks.isChatAccountUsageAvailable.mockResolvedValue(true)
    mocks.getUserCredits.mockResolvedValue({ current: 5, total: 5 })
    mocks.isChatTurnKeyClaimed.mockResolvedValue(false)
    mocks.findUnique.mockResolvedValue({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: { tutor: { prompt: 'Use course material.' } },
      mcpConfigurations: [
        {
          chatMode: 'tutor',
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

  test('returns before thread creation and forwards inactive required configs', async () => {
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
      usageClass: 'BASE',
    })
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          server: expect.objectContaining({ isActive: false }),
        }),
      ],
      'chatbot-1'
    )
    expect(mocks.createThread).not.toHaveBeenCalled()
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

  test('rejects a mode without its required MCP binding', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: {
        tutor: { prompt: 'Use course material.' },
        explainer: { prompt: 'Explain course material.' },
      },
      mcpConfigurations: [
        {
          chatMode: 'explainer',
          parameters: { required: true, toolAlias: 'doc_query' },
        },
      ],
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Required MCP tool unavailable',
      code: REQUIRED_MCP_UNAVAILABLE_CODE,
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.createThread).not.toHaveBeenCalled()
  })
})
