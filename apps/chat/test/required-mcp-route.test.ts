import { readFile } from 'node:fs/promises'
import { tool } from 'ai'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  checkDisclaimerStatus: vi.fn(),
  findUnique: vi.fn(),
  findKbServer: vi.fn(),
  findThread: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  closeMCPTools: vi.fn(),
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
  findResource: vi.fn(),
  readCourseImage: vi.fn(),
  courseImageStoreConfigured: vi.fn(),
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
    kBResource: { findFirst: mocks.findResource },
    chatbotMCPServer: { findUnique: mocks.findKbServer },
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

vi.mock('@/src/lib/server/courseImageStore', () => ({
  courseImageStoreConfigured: mocks.courseImageStoreConfigured,
  readCourseImage: mocks.readCourseImage,
}))

vi.mock('@/src/lib/server/courseImageTools', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/lib/server/courseImageTools')>()
  return { ...actual, withCourseImageTool: vi.fn(actual.withCourseImageTool) }
})

import { POST } from '../src/app/api/chatbots/[chatbotId]/chat/route'
import { withCourseImageTool } from '../src/lib/server/courseImageTools'
import {
  REQUIRED_MCP_UNAVAILABLE_CODE,
  RequiredMCPUnavailableError,
} from '../src/lib/server/mcpRuntimePolicy'
import { courseImageCandidates } from '../src/lib/sources/courseImages'

const figureResult = JSON.parse(
  await readFile('scripts/fixtures/course-images/query-result.json', 'utf8')
)
const figure = courseImageCandidates(figureResult)[0]!

const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2bf63'

function createRequest(
  selectedMode?: string,
  threadId?: string,
  extraBody: Record<string, unknown> = {}
) {
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
      ...extraBody,
    }),
  })
}

function createMcpServer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'server-1',
    name: 'IW',
    url: 'https://mcp.example.test',
    authType: 'none',
    authSecret: null,
    parameters: null,
    isActive: false,
    passChatbotId: false,
    chatbotIdHeader: null,
    ...overrides,
  }
}

function createMcpConfiguration(overrides: Record<string, unknown> = {}) {
  return {
    chatMode: 'tutor',
    isEnabled: true,
    priority: 0,
    allowedTools: ['informatik_und_wirtschaft_video_expert'],
    parameters: { required: true, toolAlias: 'doc_query' },
    mcpServer: createMcpServer(),
    ...overrides,
  }
}

function createChatbot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chatbot-1',
    ownerId: 'owner-1',
    owner: {
      aiFeaturesEnabled: true,
      aiSubscriptionTier: 'ADVANCED',
      aiChatbotCostCenter: 'cost-center-1',
    },
    course: { displayName: 'Informatik und Wirtschaft' },
    allowedModelIds: ['gpt-4.1'],
    modelSelection: true,
    answerPreferencesEnabled: true,
    systemPrompts: { tutor: { prompt: 'Use course material.' } },
    knowledgeBases: [],
    standardModeConfig: null,
    customModeConfig: null,
    mcpConfigurations: [createMcpConfiguration()],
    ...overrides,
  }
}

describe('required MCP chat preflight', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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
    mocks.claimChatTurn.mockResolvedValue({
      outcome: 'claimed',
      lifecycleAttemptId: '00000000-0000-4000-8000-000000000001',
    })
    mocks.failChatTurn.mockResolvedValue(undefined)
    mocks.compileSystemPrompt.mockReturnValue('COMPILED-SYSTEM-PROMPT')
    mocks.courseImageStoreConfigured.mockReturnValue(false)
    mocks.findUnique.mockResolvedValue(createChatbot())
    mocks.findKbServer.mockResolvedValue(
      createMcpServer({
        id: 'kb-server',
        name: 'KB',
        authType: 'scope_token',
        isActive: true,
      })
    )
    mocks.getAggregatedMCPTools.mockRejectedValue(
      new RequiredMCPUnavailableError()
    )
  })

  test.each(
    [false, true].flatMap((visionEnabled) =>
      [
        'ready',
        'missing',
        'withdrawn',
        'failed',
        'replaced',
        'inactive version',
      ].map((resourceState) => ({ visionEnabled, resourceState }))
    )
  )('validates a $resourceState figure before selection (vision: $visionEnabled)', async ({
    visionEnabled,
    resourceState,
  }) => {
    vi.stubEnv('CHAT_COURSE_IMAGE_VISION_ENABLED', String(visionEnabled))
    mocks.courseImageStoreConfigured.mockReturnValue(true)
    mocks.readCourseImage.mockResolvedValue(Buffer.from('validated image'))
    const liveResource = {
      id: figure.external_resource_id,
      kbId: figure.kb_id,
      resourceVersion: figure.resource_version,
      activeResourceVersion: figure.resource_version,
      status: 'READY',
      deletedAt: null,
    }
    const resource = {
      ...liveResource,
      ...(resourceState === 'withdrawn' ? { deletedAt: new Date() } : {}),
      ...(resourceState === 'failed' ? { status: 'FAILED' } : {}),
      ...(resourceState === 'replaced' ? { resourceVersion: 999 } : {}),
      ...(resourceState === 'inactive version'
        ? { activeResourceVersion: 999 }
        : {}),
    }
    mocks.findResource.mockImplementation(({ where }) =>
      resourceState !== 'missing' &&
      Object.entries(where).every(
        ([key, value]) => Reflect.get(resource, key) === value
      )
        ? { id: resource.id }
        : null
    )
    mocks.findUnique.mockResolvedValue(
      createChatbot({
        mcpConfigurations: [
          createMcpConfiguration({
            allowedTools: ['doc_query'],
            parameters: {
              required: true,
              toolAlias: 'doc_query',
              kb_id: figure.kb_id,
            },
            mcpServer: createMcpServer({ name: 'KB', isActive: true }),
          }),
        ],
      })
    )
    mocks.getAggregatedMCPTools.mockResolvedValue({
      tools: {
        KB_doc_query: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async () => figureResult,
        }),
      },
      close: mocks.closeMCPTools,
    })
    mocks.compileSystemPrompt.mockImplementationOnce(() => {
      throw new Error('stop after prompt compilation')
    })
    await expect(
      POST(createRequest(), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })
    ).rejects.toThrow('stop after prompt compilation')

    // Exercise the actual tools assembled by the route, not a separately wired validator.
    expect(withCourseImageTool).toHaveBeenCalledOnce()
    const tools = vi.mocked(withCourseImageTool).mock.results[0]!.value
    const options = {
      toolCallId: 'synthetic',
      messages: [],
      context: undefined,
    }
    await tools.KB_doc_query!.execute!({ query: 'Explain the figure' }, options)
    const selected = await tools.show_course_image!.execute!(
      {
        asset_id: figure.asset_id,
        reason: 'The retrieved figure explains the requested relationship.',
      },
      options
    )
    if (resourceState === 'ready') {
      expect(selected).toMatchObject({ status: 'selected', image: figure })
      expect(mocks.readCourseImage).toHaveBeenCalledWith(figure)
    } else {
      expect(selected).toEqual({ status: 'unavailable' })
      expect(mocks.readCourseImage).not.toHaveBeenCalled()
    }
    expect(mocks.findResource).toHaveBeenCalledWith({
      where: liveResource,
      select: { id: true },
    })
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
      expect.objectContaining({
        chatbotId: 'chatbot-1',
        participantId: 'participant-1',
        authMode: 'account',
        kbIds: undefined,
        sessionId: 'thread-1',
        chatMode: 'tutor',
      })
    )
    expect(mocks.getUserCredits).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1'
    )
    expect(mocks.createThread).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1',
      null,
      undefined,
      // The last parameter carries the eLearning conversation origin.
      undefined
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

  test('passes the resolved KB scope and owning thread to MCP discovery', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'chatbot-1',
      ownerId: 'owner-1',
      owner: {
        aiFeaturesEnabled: true,
        aiSubscriptionTier: 'ADVANCED',
        aiChatbotCostCenter: 'cost-center-1',
      },
      allowedModelIds: ['gpt-4.1'],
      modelSelection: true,
      systemPrompts: { tutor: { prompt: 'Use course material.' } },
      mcpConfigurations: [
        {
          chatMode: 'tutor',
          priority: 0,
          allowedTools: ['doc_query'],
          parameters: {
            required: true,
            toolAlias: 'doc_query',
            kb_id: '7016810d-31e9-4b39-9529-cd46feb2bf63',
          },
          mcpServer: {
            id: 'kb-server',
            name: 'KB',
            url: 'https://mcp.example.test',
            authType: 'bearer',
            authSecret: 'opaque-transport-token',
            parameters: null,
            isActive: true,
            passChatbotId: false,
            chatbotIdHeader: null,
          },
        },
      ],
    })

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          server: expect.objectContaining({ name: 'KB' }),
        }),
      ],
      expect.objectContaining({
        chatbotId: 'chatbot-1',
        participantId: 'participant-1',
        authMode: 'account',
        kbIds: [KB_ID],
        sessionId: 'thread-1',
        chatMode: 'tutor',
      })
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

  test('accepts legacy casing for a standard mode', async () => {
    const response = await POST(createRequest('Tutor'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
  })

  test('selects and passes the course display name to prompt compilation', async () => {
    // The practice tool is registered by deployment capability, so the test
    // pins a practice MCP URL instead of inheriting it from the environment.
    vi.stubEnv('MCP_STUDENT_URL', 'http://mcp-student.test/mcp')
    const displayName = 'Informatik und Wirtschaft'
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({ course: { displayName } })
    )
    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: {},
      close: mocks.closeMCPTools,
    })
    mocks.compileSystemPrompt.mockImplementationOnce(() => {
      throw new Error('stop after prompt compilation')
    })

    await expect(
      POST(createRequest(), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })
    ).rejects.toThrow('stop after prompt compilation')

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'chatbot-1' },
      include: {
        owner: {
          select: {
            aiFeaturesEnabled: true,
            aiSubscriptionTier: true,
            aiChatbotCostCenter: true,
          },
        },
        course: { select: { displayName: true } },
        knowledgeBases: {
          select: {
            id: true,
            kbId: true,
            isEnabled: true,
            isDefault: true,
            kb: {
              select: {
                deletedAt: true,
                ownerId: true,
                name: true,
                knowledgeGraphEnabled: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
        mcpConfigurations: {
          include: { mcpServer: true },
          orderBy: { priority: 'asc' },
        },
      },
    })
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      { tutor: { prompt: 'Use course material.' } },
      'tutor',
      {
        courseDisplayName: displayName,
        customModeConfig: null,
        toolNames: ['start_student_practice_quiz'],
        standardModeConfig: null,
        // The request omits both preferences, which fall back to defaults.
        answerStyle: 'balanced',
        answerTone: 'neutral',
      }
    )
  })

  test.each([
    {
      enabled: true,
      expected: { answerStyle: 'bullets', answerTone: 'direct' },
    },
    {
      enabled: false,
      expected: { answerStyle: 'balanced', answerTone: 'neutral' },
    },
  ])('applies student answer preferences only when the chatbot allows them (enabled: $enabled)', async ({
    enabled,
    expected,
  }) => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({ answerPreferencesEnabled: enabled })
    )
    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: {},
      close: mocks.closeMCPTools,
    })
    mocks.compileSystemPrompt.mockImplementationOnce(() => {
      throw new Error('stop after prompt compilation')
    })

    await expect(
      POST(
        createRequest(undefined, undefined, {
          answerStyle: 'bullets',
          answerTone: 'direct',
        }),
        { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
      )
    ).rejects.toThrow('stop after prompt compilation')

    expect(mocks.compileSystemPrompt).toHaveBeenLastCalledWith(
      expect.anything(),
      'tutor',
      expect.objectContaining(expected)
    )
  })

  test('rejects a request for a typed-disabled mode before MCP and thread work', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: true,
          quizzerEnabled: false,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
        mcpConfigurations: [],
      })
    )

    const response = await POST(createRequest('tutor'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported chat mode: tutor',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.createThread).not.toHaveBeenCalled()
  })

  test('serves an unbound mode without KB targets instead of hiding it', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        systemPrompts: {
          tutor: { prompt: 'Use course material.' },
          explainer: { prompt: 'Explain course material.' },
        },
        mcpConfigurations: [
          createMcpConfiguration({
            chatMode: 'explainer',
            mcpServer: createMcpServer({ id: 'kb-server', name: 'KB' }),
            parameters: {
              required: true,
              toolAlias: 'doc_query',
              kb_id: KB_ID,
            },
          }),
        ],
      })
    )
    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: {},
      close: mocks.closeMCPTools,
    })
    mocks.compileSystemPrompt.mockImplementationOnce(() => {
      throw new Error('stop after prompt compilation')
    })

    await expect(
      POST(createRequest('tutor'), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })
    ).rejects.toThrow('stop after prompt compilation')

    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
    const [servers, context] = mocks.getAggregatedMCPTools.mock.calls[0]
    expect(servers).toEqual([])
    expect(context.kbIds).toBeUndefined()
  })

  test('forwards an inherited required document-query binding for Quizzer', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        systemPrompts: {
          tutor: { prompt: 'Use course material.' },
          quizzer: { prompt: 'Ask course questions.' },
        },
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: false,
          quizzerEnabled: true,
          writingCoachEnabled: false,
          explicitModeSelection: true,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
        mcpConfigurations: [
          createMcpConfiguration({
            allowedTools: ['doc_query'],
            parameters: {
              required: true,
              toolAlias: 'doc_query',
              kb_id: KB_ID,
            },
            mcpServer: createMcpServer({
              id: 'kb-server',
              name: 'KB',
              authType: 'bearer',
              authSecret: 'opaque-transport-token',
              isActive: true,
            }),
          }),
        ],
      })
    )

    const response = await POST(createRequest('quizzer'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          config: expect.objectContaining({
            allowedTools: ['doc_query'],
            parameters: {
              required: true,
              toolAlias: 'doc_query',
              kb_id: KB_ID,
            },
          }),
        }),
      ],
      expect.objectContaining({
        chatbotId: 'chatbot-1',
        participantId: 'participant-1',
        authMode: 'account',
        kbIds: [KB_ID],
        sessionId: 'thread-1',
        chatMode: 'quizzer',
      })
    )
  })

  test('fails Quizzer closed when optional MCP discovery returns no document-query tool', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        mcpConfigurations: [
          createMcpConfiguration({
            allowedTools: ['doc_query'],
            parameters: null,
            mcpServer: createMcpServer({ name: 'Course', isActive: true }),
          }),
        ],
      })
    )
    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: {},
      close: mocks.closeMCPTools,
    })

    const response = await POST(createRequest('quizzer'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Required MCP tool unavailable',
      code: REQUIRED_MCP_UNAVAILABLE_CODE,
    })
    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
    expect(mocks.deleteThread).toHaveBeenCalledWith(
      'thread-1',
      'participant-1',
      'chatbot-1'
    )
    expect(mocks.failChatTurn).not.toHaveBeenCalled()
  })

  test('offers KB-free Quizzer without treating a wildcard Tutor binding as retrieval', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        systemPrompts: {
          tutor: { prompt: 'Use course material.' },
          quizzer: { prompt: 'Ask course questions.' },
        },
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: false,
          quizzerEnabled: true,
          writingCoachEnabled: false,
          explicitModeSelection: true,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
        mcpConfigurations: [
          createMcpConfiguration({
            allowedTools: ['*'],
            parameters: null,
            mcpServer: { id: 'server-1' },
          }),
        ],
      })
    )

    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: {},
      close: mocks.closeMCPTools,
    })
    mocks.compileSystemPrompt.mockImplementationOnce(() => {
      throw new Error('stop after prompt compilation')
    })

    await expect(
      POST(createRequest('quizzer'), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })
    ).rejects.toThrow('stop after prompt compilation')

    expect(mocks.getAggregatedMCPTools).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ kbIds: undefined })
    )
    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      'quizzer',
      expect.objectContaining({
        toolNames: expect.not.arrayContaining(['KB_doc_query']),
      })
    )
  })

  test('defaults an omitted request to the only approved custom mode', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        customModeConfig: {
          modes: [
            {
              key: 'cm_custom_only',
              name: 'Case practice',
              description: 'Practises a course case.',
              personaText: 'Run a case practice.',
            },
          ],
        },
        mcpConfigurations: [],
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: false,
          quizzerEnabled: false,
          writingCoachEnabled: false,
          explicitModeSelection: true,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
      })
    )
    mocks.getAggregatedMCPTools.mockResolvedValueOnce({
      tools: {},
      close: mocks.closeMCPTools,
    })
    mocks.compileSystemPrompt.mockImplementationOnce(() => {
      throw new Error('stop after prompt compilation')
    })

    await expect(
      POST(createRequest(), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })
    ).rejects.toThrow('stop after prompt compilation')

    expect(mocks.compileSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      'cm_custom_only',
      expect.anything()
    )
  })

  test('rejects a chatbot with no offered mode before thread or MCP work', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        customModeConfig: null,
        mcpConfigurations: [],
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: false,
          quizzerEnabled: false,
          writingCoachEnabled: false,
          explicitModeSelection: true,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
      })
    )

    const response = await POST(createRequest(), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No chat mode is available',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
    expect(mocks.createThread).not.toHaveBeenCalled()
  })

  test('preserves the exact key for a mixed-case custom mode', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        customModeConfig: {
          modes: [
            {
              key: 'QuickCheck',
              name: 'QuickCheck',
              description: 'Asks one brief diagnostic question.',
              personaText: 'Ask one brief question.',
            },
          ],
        },
        systemPrompts: {
          QuickCheck: { prompt: 'Ask one brief question.' },
        },
        mcpConfigurations: [
          createMcpConfiguration({
            allowedTools: ['course_search'],
            chatMode: 'QuickCheck',
            parameters: { required: true, toolAlias: 'doc_query' },
            mcpServer: createMcpServer({ name: 'Course' }),
          }),
        ],
      })
    )

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
      expect.objectContaining({
        chatbotId: 'chatbot-1',
        participantId: 'participant-1',
        authMode: 'account',
        kbIds: undefined,
        sessionId: 'thread-1',
        chatMode: 'QuickCheck',
      })
    )
  })

  test('rejects a stored mode key that the chatbot has not approved', async () => {
    mocks.findUnique.mockResolvedValueOnce(
      createChatbot({
        systemPrompts: {
          tutor: { prompt: 'Use course material.' },
          QuickCheck: { prompt: 'Ask one brief question.' },
        },
        mcpConfigurations: [
          createMcpConfiguration({
            allowedTools: ['course_search'],
            chatMode: 'QuickCheck',
            parameters: { required: true, toolAlias: 'doc_query' },
            mcpServer: createMcpServer({ name: 'Course' }),
          }),
        ],
      })
    )

    const response = await POST(createRequest('QuickCheck'), {
      params: Promise.resolve({ chatbotId: 'chatbot-1' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported chat mode: QuickCheck',
    })
    expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
  })

  describe('explicit mode knowledge-base selection', () => {
    const KB_B_ID = '2f0c4a1e-6b57-4d4b-9a54-6a9c4a3d1b10'
    const LINK_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const LINK_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const MODE_KEY = 'cm_case_practice'

    // Mirrors the managed-link rows the route selects.
    const kbLink = (
      id: string,
      kbId: string,
      overrides: Record<string, unknown> = {}
    ) => ({
      id,
      kbId,
      isEnabled: true,
      isDefault: false,
      kb: {
        deletedAt: null,
        ownerId: 'owner-1',
        name: 'Synthetic source',
        knowledgeGraphEnabled: false,
      },
      ...overrides,
    })

    // A custom-only chatbot: no persisted MCP rows and no default link.
    function explicitChatbot(
      linkId: string | null,
      knowledgeBases: unknown[] = [
        kbLink(LINK_A, KB_ID),
        kbLink(LINK_B, KB_B_ID),
      ]
    ) {
      return createChatbot({
        customModeConfig: {
          modes: [
            {
              key: MODE_KEY,
              name: 'Case practice',
              description: 'Practises a course case.',
              personaText: 'Run a case practice.',
              knowledgeBaseLinkId: linkId,
            },
          ],
        },
        knowledgeBases,
        mcpConfigurations: [],
        standardModeConfig: {
          tutorEnabled: false,
          explainerEnabled: false,
          quizzerEnabled: false,
          writingCoachEnabled: false,
          explicitModeSelection: true,
          courseName: null,
          subjectDomain: null,
          languageOfInstruction: null,
          scopeNote: null,
        },
      })
    }

    test.each([
      ['A', LINK_A, KB_ID],
      ['B', LINK_B, KB_B_ID],
    ])('sends exactly source %s with no persisted MCP rows', async (_label, linkId, kbId) => {
      mocks.findUnique.mockResolvedValueOnce(explicitChatbot(linkId))
      mocks.getAggregatedMCPTools.mockResolvedValueOnce({
        tools: {},
        close: mocks.closeMCPTools,
      })
      mocks.compileSystemPrompt.mockImplementationOnce(() => {
        throw new Error('stop after prompt compilation')
      })

      await expect(
        POST(createRequest(MODE_KEY), {
          params: Promise.resolve({ chatbotId: 'chatbot-1' }),
        })
      ).rejects.toThrow('stop after prompt compilation')

      expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
      const [configurations, options] =
        mocks.getAggregatedMCPTools.mock.calls[0]!
      expect(configurations).toHaveLength(1)
      expect(configurations[0].server).toMatchObject({ name: 'KB' })
      expect(configurations[0].config).toMatchObject({
        allowedTools: ['doc_query'],
        parameters: { kb_id: kbId, required: true, toolAlias: 'doc_query' },
      })
      expect(configurations[0].config.parameters).not.toHaveProperty('kb_ids')
      expect(options).toMatchObject({
        chatMode: MODE_KEY,
        kbIds: [kbId],
        kbLinkId: linkId,
        participantId: 'participant-1',
      })
      expect(options.revalidateKnowledgeBaseScope).toEqual(expect.any(Function))
    })

    test.each([
      ['a nonexistent link', LINK_A, [kbLink(LINK_B, KB_B_ID)]],
      ['a revoked link', LINK_A, [kbLink(LINK_A, KB_ID, { isEnabled: false })]],
      [
        'a soft-deleted source',
        LINK_A,
        [
          kbLink(LINK_A, KB_ID, {
            kb: { deletedAt: new Date(0), ownerId: 'owner-1' },
          }),
        ],
      ],
      [
        'a source owned by someone else',
        LINK_A,
        [kbLink(LINK_A, KB_ID, { kb: { deletedAt: null, ownerId: 'other' } })],
      ],
      [
        'a missing source when another link is the default',
        LINK_A,
        [kbLink(LINK_B, KB_B_ID, { isDefault: true })],
      ],
    ])('refuses %s before any thread, provider or document work', async (_label, linkId, knowledgeBases) => {
      mocks.findUnique.mockResolvedValueOnce(
        explicitChatbot(linkId, knowledgeBases)
      )

      const response = await POST(createRequest(MODE_KEY), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({
        code: REQUIRED_MCP_UNAVAILABLE_CODE,
      })
      expect(mocks.findKbServer).not.toHaveBeenCalled()
      expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
      expect(mocks.createThread).not.toHaveBeenCalled()
      expect(mocks.compileSystemPrompt).not.toHaveBeenCalled()
    })

    test('stops with unavailability when discovery for an explicit source fails', async () => {
      mocks.findUnique.mockResolvedValueOnce(explicitChatbot(LINK_A))

      const response = await POST(createRequest(MODE_KEY), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })

      expect(response.status).toBe(503)
      expect(mocks.getAggregatedMCPTools).toHaveBeenCalledOnce()
      expect(mocks.compileSystemPrompt).not.toHaveBeenCalled()
    })

    test('refuses an explicit source when the Doc Query server is unavailable', async () => {
      mocks.findKbServer.mockResolvedValueOnce(null)
      mocks.findUnique.mockResolvedValueOnce(explicitChatbot(LINK_A))

      const response = await POST(createRequest(MODE_KEY), {
        params: Promise.resolve({ chatbotId: 'chatbot-1' }),
      })

      expect(response.status).toBe(503)
      expect(mocks.getAggregatedMCPTools).not.toHaveBeenCalled()
      expect(mocks.compileSystemPrompt).not.toHaveBeenCalled()
    })

    test('an inheriting mode without a default searches no source', async () => {
      mocks.findUnique.mockResolvedValueOnce(explicitChatbot(null))
      mocks.getAggregatedMCPTools.mockResolvedValueOnce({
        tools: {},
        close: mocks.closeMCPTools,
      })
      mocks.compileSystemPrompt.mockImplementationOnce(() => {
        throw new Error('stop after prompt compilation')
      })

      await expect(
        POST(createRequest(MODE_KEY), {
          params: Promise.resolve({ chatbotId: 'chatbot-1' }),
        })
      ).rejects.toThrow('stop after prompt compilation')

      expect(mocks.findKbServer).not.toHaveBeenCalled()
      const [configurations, options] = mocks.getAggregatedMCPTools.mock
        .calls[0] ?? [[], {}]
      expect(configurations).toEqual([])
      expect(options.kbIds).toBeUndefined()
    })
  })
})
