import { NextRequest } from 'next/server'
import { signJWT } from '@klicker-uzh/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  checkDisclaimerStatus: vi.fn(),
  findUnique: vi.fn(),
  findThread: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  createThread: vi.fn(),
  findFailedTurnThreadId: vi.fn(),
  updateMessage: vi.fn(),
  findMessage: vi.fn(),
  findAttachments: vi.fn(),
  previewUserCredits: vi.fn(),
  getUserCredits: vi.fn(),
  isChatAccountUsageEnforcementEnabled: vi.fn(),
  isChatAccountUsageAvailable: vi.fn(),
  claimChatTurn: vi.fn(),
  failChatTurn: vi.fn(),
  compileSystemPrompt: vi.fn(),
  createMessage: vi.fn(),
  findMessageById: vi.fn(),
  updateThread: vi.fn(),
  deleteThread: vi.fn(),
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
      update: mocks.updateThread,
    },
    chatMessage: {
      updateMany: mocks.updateMessage,
      findFirst: mocks.findMessage,
      create: mocks.createMessage,
      findUnique: mocks.findMessageById,
    },
    chatAttachment: {
      findMany: mocks.findAttachments,
    },
    responseExampleSet: {
      findUnique: vi.fn().mockResolvedValue(null),
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

import { POST } from '../src/app/api/chatbots/[chatbotId]/chat/route'
import {
  REQUIRED_MCP_UNAVAILABLE_CODE,
  RequiredMCPUnavailableError,
} from '../src/lib/server/mcpRuntimePolicy'

const SECRET = 'test-elearning-handoff-secret'
const CHATBOT_ID = 'chatbot-1'
const COURSE_ID = 'course-1'
const LEARNER_BINDING = 'binding-1'
const THREAD_ID = 'thread-elearning'

function sufficientExcerpt(): string {
  return 'word '.repeat(220)
}

function snapshot() {
  return {
    snapshotId: 'snap-1',
    observedAt: '2026-09-12T10:00:00Z',
    locale: 'de',
    location: {
      surface: 'block',
      moduleId: 'm1',
      unitId: 'u1',
      blockIdent: 'b1',
      title: 'Compound interest',
      deepLink: '/de/course/1/module/1/unit/1/block/b1',
    },
    material: {
      title: 'Reading',
      blockType: 'pdf',
      blockIdent: 'b1',
      availability: 'full-text',
      excerpt: sufficientExcerpt(),
      excerptTruncated: false,
      revision: 'rev-1',
    },
  }
}

async function elearningEnvelope() {
  const now = Math.floor(Date.now() / 1000)
  return signJWT(
    {
      scope: 'ELEARNING_SNAPSHOT',
      chatbotId: CHATBOT_ID,
      klickerCourseId: COURSE_ID,
      snapshot: snapshot(),
      sub: LEARNER_BINDING,
      iat: now,
      exp: now + 300,
    },
    SECRET,
    { issuer: 'elearning' }
  )
}

function createRequest(
  envelope: string | null = null,
  extra: Record<string, unknown> = {}
) {
  return new NextRequest(`http://localhost/api/chatbots/${CHATBOT_ID}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          id: 'user-message-1',
          role: 'user',
          content: 'Explain this page.',
        },
      ],
      selectedModel: 'gpt-4.1',
      assistantMessageId: 'assistant-1',
      threadId: THREAD_ID,
      ...(envelope
        ? {
            chatContext: {
              version: 1,
              source: 'elearning',
              locale: 'de',
              envelope,
            },
          }
        : {}),
      ...extra,
    }),
  })
}

function requiredMcpConfiguration() {
  return {
    chatMode: 'tutor',
    isEnabled: true,
    priority: 0,
    allowedTools: ['doc_query'],
    parameters: { required: true, toolAlias: 'doc_query' },
    mcpServer: {
      id: 'server-1',
      name: 'IW',
      url: 'https://mcp.example.test',
      authType: 'none',
      isActive: false,
    },
  }
}

function originalSnapshot() {
  return {
    snapshotId: 'snap-original',
    observedAt: '2026-09-12T09:00:00Z',
    locale: 'de',
    location: {
      surface: 'block',
      moduleId: 'm0',
      unitId: 'u0',
      blockIdent: 'b0',
      title: 'Simple interest',
    },
    material: {
      title: 'Reading',
      blockType: 'pdf',
      blockIdent: 'b0',
      availability: 'full-text',
      excerpt: 'word '.repeat(60),
      excerptTruncated: false,
      revision: 'rev-0',
    },
  }
}

function createChatbot(overrides: Record<string, unknown> = {}) {
  return {
    id: CHATBOT_ID,
    ownerId: 'owner-1',
    owner: { aiFeaturesEnabled: true },
    course: { displayName: 'Informatik und Wirtschaft' },
    allowedModelIds: ['gpt-4.1'],
    modelSelection: true,
    systemPrompts: { tutor: { prompt: 'Use course material.' } },
    knowledgeBases: [],
    standardModeConfig: null,
    mcpConfigurations: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ELEARNING_CHAT_HANDOFF_SECRET', SECRET)
  vi.stubEnv('APP_SECRET', 'test-app-secret')
  mocks.withChatbotAuth.mockResolvedValue({
    participantId: 'participant-1',
    authMode: 'account',
    learnerBinding: LEARNER_BINDING,
    chatbot: { courseId: COURSE_ID },
  })
  mocks.checkDisclaimerStatus.mockResolvedValue({
    required: false,
    accepted: true,
  })
  mocks.findUnique.mockResolvedValue(createChatbot())
  mocks.findThread.mockResolvedValue({
    id: THREAD_ID,
    participantId: 'participant-1',
    chatbotId: CHATBOT_ID,
    origin: 'elearning',
    title: null,
  })
  mocks.findFailedTurnThreadId.mockResolvedValue(null)
  mocks.findAttachments.mockResolvedValue([])
  mocks.findMessage.mockResolvedValue(null)
  mocks.isChatAccountUsageEnforcementEnabled.mockReturnValue(true)
  mocks.isChatAccountUsageAvailable.mockResolvedValue(true)
  mocks.previewUserCredits.mockResolvedValue({ current: 5, total: 5 })
  mocks.getUserCredits.mockResolvedValue({ current: 5, total: 5 })
  mocks.claimChatTurn.mockResolvedValue({
    outcome: 'claimed',
    lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
  })
  mocks.getAggregatedMCPTools.mockResolvedValue({ tools: [] })
  mocks.compileSystemPrompt.mockReturnValue('COMPILED-SYSTEM-PROMPT')
  mocks.createMessage.mockResolvedValue({ id: 'user-message-1' })
  mocks.findMessageById.mockResolvedValue(null)
  mocks.updateThread.mockResolvedValue({})
  mocks.deleteThread.mockResolvedValue(true)
})

describe('eLearning save-before-generation', () => {
  test('returns 503 without generating when the user message cannot be persisted', async () => {
    mocks.updateMessage.mockRejectedValue(new Error('db down'))

    const response = await POST(createRequest(await elearningEnvelope()), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to persist the question context',
      code: 'ELEARNING_CONTEXT_PERSIST_FAILED',
    })
    expect(mocks.updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-message-1', threadId: THREAD_ID },
      })
    )
  })
})

describe('eLearning origin and branch context', () => {
  test('retains the edited question context instead of the live page', async () => {
    const SOURCE_MESSAGE_ID = 'user-message-0'
    // Held on an object so the assertion reads the value assigned inside the
    // create callback rather than the initializer.
    const captured: {
      create: { data?: { learningContext?: { snapshotId?: string } } } | null
    } = { create: null }

    mocks.updateMessage.mockResolvedValue({ count: 0 })
    mocks.findMessageById.mockResolvedValue(null)
    mocks.findMessage.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === SOURCE_MESSAGE_ID
          ? { learningContext: originalSnapshot() }
          : null
    )
    mocks.createMessage.mockImplementation(async (args: never) => {
      captured.create = args
      throw new Error('db down')
    })

    const response = await POST(
      createRequest(await elearningEnvelope(), {
        sourceMessageId: SOURCE_MESSAGE_ID,
      }),
      { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
    )

    expect(response.status).toBe(503)
    expect(captured.create?.data?.learningContext?.snapshotId).toBe(
      'snap-original'
    )
  })

  test('keeps an eLearning thread answering without a snapshot', async () => {
    mocks.updateMessage.mockRejectedValue(new Error('db down'))

    const response = await POST(createRequest(null), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to persist the question context',
      code: 'ELEARNING_CONTEXT_PERSIST_FAILED',
    })
  })

  test('degrades to page-only evidence when required retrieval is unavailable', async () => {
    mocks.findUnique.mockResolvedValue(
      createChatbot({ mcpConfigurations: [requiredMcpConfiguration()] })
    )
    mocks.getAggregatedMCPTools.mockRejectedValue(
      new RequiredMCPUnavailableError()
    )
    mocks.updateMessage.mockRejectedValue(new Error('db down'))

    const response = await POST(createRequest(await elearningEnvelope()), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    // Reaching persistence proves the retrieval failure did not reject the
    // turn; the ordinary chat path still fails closed.
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to persist the question context',
      code: 'ELEARNING_CONTEXT_PERSIST_FAILED',
    })
    expect(mocks.deleteThread).not.toHaveBeenCalled()
  })

  test('tags a legacy eLearning thread so the policy and history keep it', async () => {
    mocks.findThread.mockResolvedValue({
      id: THREAD_ID,
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      origin: null,
      title: null,
    })
    mocks.updateMessage.mockRejectedValue(new Error('db down'))

    const response = await POST(createRequest(await elearningEnvelope()), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(response.status).toBe(503)
    expect(mocks.updateThread).toHaveBeenCalledWith({
      where: { id: THREAD_ID },
      data: { origin: 'elearning' },
    })
  })
})

describe('eLearning provenance and retrieval failure modes', () => {
  test('fails closed when the eLearning origin tag cannot be persisted', async () => {
    mocks.findThread.mockResolvedValue({
      id: THREAD_ID,
      participantId: 'participant-1',
      chatbotId: CHATBOT_ID,
      origin: null,
      title: null,
    })
    mocks.updateThread.mockRejectedValue(new Error('db down'))

    const response = await POST(createRequest(await elearningEnvelope()), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    // Untagged, later turns of this conversation would silently lose the
    // materials-only policy, so the turn must not succeed here.
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to persist the question context',
      code: 'ELEARNING_CONTEXT_PERSIST_FAILED',
    })
  })

  test('keeps a historical null snapshot unavailable instead of the live page', async () => {
    const SOURCE_MESSAGE_ID = 'user-message-0'
    const captured: {
      create: { data?: { learningContext?: unknown } } | null
    } = {
      create: null,
    }
    mocks.updateMessage.mockResolvedValue({ count: 0 })
    mocks.findMessageById.mockResolvedValue(null)
    mocks.findMessage.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === SOURCE_MESSAGE_ID ? { learningContext: null } : null
    )
    mocks.createMessage.mockImplementation(async (args: never) => {
      captured.create = args
      throw new Error('db down')
    })

    const response = await POST(
      createRequest(await elearningEnvelope(), {
        sourceMessageId: SOURCE_MESSAGE_ID,
      }),
      { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
    )

    expect(response.status).toBe(503)
    // The envelope in this request is live page evidence; the stored null
    // must win so an edited historical question is not re-anchored to it.
    expect(captured.create?.data?.learningContext).toBeUndefined()
  })

  test('refuses a branch whose source message is outside the thread', async () => {
    mocks.findMessage.mockResolvedValue(null)

    const response = await POST(
      createRequest(await elearningEnvelope(), {
        sourceMessageId: 'user-message-other',
      }),
      { params: Promise.resolve({ chatbotId: CHATBOT_ID }) }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Source message not found',
    })
  })

  test('keeps a scoped retrieval violation fail-closed instead of degrading', async () => {
    mocks.findUnique.mockResolvedValue(
      createChatbot({ mcpConfigurations: [requiredMcpConfiguration()] })
    )
    mocks.getAggregatedMCPTools.mockRejectedValue(
      new RequiredMCPUnavailableError('scope_violation')
    )

    const response = await POST(createRequest(await elearningEnvelope()), {
      params: Promise.resolve({ chatbotId: CHATBOT_ID }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Required MCP tool unavailable',
      code: REQUIRED_MCP_UNAVAILABLE_CODE,
    })
    // A scope failure must stop before the question is persisted or streamed.
    expect(mocks.updateMessage).not.toHaveBeenCalled()
  })
})
