import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

type GenerateToolOptions = {
  onNestedUsage: (usage: {
    inputTokens?: number
    outputTokens?: number
  }) => void
}

const mocks = vi.hoisted(() => ({
  withChatbotAuth: vi.fn(),
  checkDisclaimerStatus: vi.fn(),
  chatbotFindUnique: vi.fn(),
  courseFindUnique: vi.fn(),
  chatMessageFindMany: vi.fn(),
  chatMessageFindUnique: vi.fn(),
  chatMessageCreate: vi.fn(),
  chatMessageUpdateMany: vi.fn(),
  chatMessageDeleteMany: vi.fn(),
  chatAttachmentFindMany: vi.fn(),
  chatThreadFindFirst: vi.fn(),
  chatThreadUpdate: vi.fn(),
  getAggregatedMCPTools: vi.fn(),
  getUserCredits: vi.fn(),
  previewUserCredits: vi.fn(),
  decrementCredits: vi.fn(),
  claimChatTurn: vi.fn(),
  failChatTurn: vi.fn(),
  finalizeChatTurn: vi.fn(),
  isChatAccountUsageEnforcementEnabled: vi.fn(),
  isChatAccountUsageAvailable: vi.fn(),
  roundChatUsageCredits: vi.fn(),
  buildPromptCacheRequest: vi.fn(),
  streamText: vi.fn(),
  toUIMessageStream: vi.fn(),
  listPersonalElements: vi.fn(),
  listDiscardedCandidateIds: vi.fn(),
  listCompletedGenerationLeaseAttemptTokens: vi.fn(),
  claimCardGenerationLease: vi.fn(),
  completeCardGenerationLease: vi.fn(),
  abortCardGenerationLease: vi.fn(),
  createProposeCardPlanTool: vi.fn(() => ({ execute: vi.fn() })),
  createGenerateCardsTool: vi.fn((_options: GenerateToolOptions) => ({
    execute: vi.fn(),
  })),
  isPersonalCardGenerationEnabled: vi.fn(),
  generateToolOptions: [] as GenerateToolOptions[],
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  listPersonalElements: mocks.listPersonalElements,
  listDiscardedCandidateIds: mocks.listDiscardedCandidateIds,
  listCompletedGenerationLeaseAttemptTokens:
    mocks.listCompletedGenerationLeaseAttemptTokens,
  claimCardGenerationLease: mocks.claimCardGenerationLease,
  completeCardGenerationLease: mocks.completeCardGenerationLease,
  abortCardGenerationLease: mocks.abortCardGenerationLease,
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
    chatbot: { findUnique: mocks.chatbotFindUnique },
    course: { findUnique: mocks.courseFindUnique },
    chatMessage: {
      findMany: mocks.chatMessageFindMany,
      findUnique: mocks.chatMessageFindUnique,
      create: mocks.chatMessageCreate,
      updateMany: mocks.chatMessageUpdateMany,
      deleteMany: mocks.chatMessageDeleteMany,
    },
    chatAttachment: { findMany: mocks.chatAttachmentFindMany },
    chatThread: {
      findFirst: mocks.chatThreadFindFirst,
      update: mocks.chatThreadUpdate,
    },
  },
}))

vi.mock('@/src/services/mcpClients', () => ({
  getAggregatedMCPTools: mocks.getAggregatedMCPTools,
}))

vi.mock('@/src/services/credits', () => ({
  CreditsService: {
    getUserCredits: mocks.getUserCredits,
    previewUserCredits: mocks.previewUserCredits,
    decrementCredits: mocks.decrementCredits,
  },
}))

vi.mock('@/src/services/accountUsage', () => {
  class ChatTurnConflictError extends Error {}

  return {
    CHAT_TURN_ALREADY_COMPLETED_CODE: 'CHAT_TURN_ALREADY_COMPLETED',
    ChatTurnConflictError,
    claimChatTurn: mocks.claimChatTurn,
    failChatTurn: mocks.failChatTurn,
    finalizeChatTurn: mocks.finalizeChatTurn,
    isChatAccountUsageEnforcementEnabled:
      mocks.isChatAccountUsageEnforcementEnabled,
    isChatAccountUsageAvailable: mocks.isChatAccountUsageAvailable,
    roundChatUsageCredits: mocks.roundChatUsageCredits,
  }
})

vi.mock('@/src/lib/server/promptCacheIdentity', () => ({
  buildPromptCacheRequest: mocks.buildPromptCacheRequest,
}))

vi.mock('@/src/lib/server/personalElements/tools', () => ({
  createGenerateCardsTool: mocks.createGenerateCardsTool,
  createListPersonalElementsTool: vi.fn(() => ({ execute: vi.fn() })),
  createProposeCardPlanTool: mocks.createProposeCardPlanTool,
  createRevisePersonalElementTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock('@/src/lib/server/personalElements/featureFlag', () => ({
  isPersonalCardGenerationEnabled: mocks.isPersonalCardGenerationEnabled,
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: mocks.streamText,
  }
})

import { POST } from '../src/app/api/chatbots/[chatbotId]/chat/route'

const docQueryTool = {
  description: 'Search the course material.',
  inputSchema: z.object({ query: z.string() }),
  execute: vi.fn(),
}

function createRequest(
  content: string,
  assistantMessageId: string,
  options: {
    parentId?: string
    approvedPlan?: { messageId: string; toolCallId: string }
  } = {}
) {
  return new NextRequest('http://localhost/api/chatbots/chatbot-1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ id: 'user-1', role: 'user', content }],
      threadId: 'thread-1',
      ...(options.parentId ? { parentId: options.parentId } : {}),
      selectedModel: 'gpt-4.1',
      selectedMode: 'explainer',
      assistantMessageId,
      ...(options.approvedPlan ? { approvedPlan: options.approvedPlan } : {}),
    }),
  })
}

function emptyRetrievalStep() {
  return {
    toolResults: [
      {
        type: 'tool-result',
        toolName: 'KB_doc_query',
        output: { sources: [] },
      },
    ],
  }
}

function malformedRetrievalStep() {
  return {
    toolResults: [
      {
        type: 'tool-result',
        toolName: 'KB_doc_query',
        output: {
          sources: [
            {
              file_name: 'CAPM',
              chunks: [{ content: 'Missing stable chunk ID.' }],
            },
          ],
        },
      },
    ],
  }
}

function validRetrievalStep() {
  return {
    toolResults: [
      {
        type: 'tool-result',
        toolName: 'KB_doc_query',
        output: {
          sources: [
            {
              file_name: 'CAPM',
              chunks: [{ chunk_id: 'chunk-1', content: 'Synthetic evidence.' }],
            },
          ],
        },
      },
    ],
  }
}

async function readSseChunks(response: Response) {
  const body = await response.text()
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice('data: '.length))) as Array<{
    type: string
    [key: string]: unknown
  }>
}

function approvedPlanHistory(
  planMessageId: string,
  planToolCallId: string,
  cards: Array<{
    candidateId: string
    title: string
    intent: string
    query: string
  }>
) {
  return [
    {
      id: 'user-1',
      parentId: null,
      role: 'user',
      content: 'Generate flashcards about CAPM.',
      createdAt: new Date('2026-08-24T10:00:00.000Z'),
    },
    {
      id: planMessageId,
      parentId: 'user-1',
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: planToolCallId,
          toolName: 'propose_card_plan',
          result: {
            planId: '00000000-0000-0000-0000-000000000003',
            topic: 'CAPM',
            cards: cards.map((card) => ({ type: 'FLASHCARD', ...card })),
          },
        },
        {
          type: 'tool-result',
          toolName: 'KB_doc_query',
          output: validRetrievalStep().toolResults[0].output,
        },
      ],
      createdAt: new Date('2026-08-24T10:01:00.000Z'),
    },
  ]
}

describe('retrieval route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateToolOptions.length = 0
    process.env.OPENAI_BASE_URL = 'https://example.test/v1'

    mocks.withChatbotAuth.mockResolvedValue({ participantId: 'participant-1' })
    mocks.checkDisclaimerStatus.mockResolvedValue({
      required: false,
      accepted: true,
    })
    mocks.chatbotFindUnique.mockResolvedValue({
      id: 'chatbot-1',
      courseId: 'course-1',
      systemPrompts: {
        tutor: { prompt: 'Use course material.' },
        explainer: { prompt: 'Explain course material.' },
      },
      allowedModelIds: [],
      allowedReasoningEffortsByModel: {},
      modelSelection: true,
      openaiApiKey: null,
      openaiBaseUrl: null,
      mcpConfigurations: [
        {
          chatMode: 'explainer',
          priority: 0,
          allowedTools: ['doc_query'],
          parameters: { required: true, toolAlias: 'doc_query' },
          mcpServer: {
            id: 'server-1',
            name: 'Course knowledge base',
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
    mocks.courseFindUnique.mockResolvedValue({ language: 'en' })
    mocks.chatMessageFindMany.mockResolvedValue([])
    mocks.chatMessageFindUnique.mockResolvedValue(null)
    mocks.chatMessageCreate.mockResolvedValue({ id: 'assistant-created' })
    mocks.chatMessageUpdateMany.mockResolvedValue({ count: 1 })
    mocks.chatAttachmentFindMany.mockResolvedValue([])
    mocks.claimCardGenerationLease.mockResolvedValue({ id: 'lease-1' })
    mocks.completeCardGenerationLease.mockResolvedValue(true)
    mocks.abortCardGenerationLease.mockResolvedValue(true)
    mocks.listDiscardedCandidateIds.mockResolvedValue([])
    mocks.listCompletedGenerationLeaseAttemptTokens.mockResolvedValue([])
    mocks.chatThreadFindFirst.mockResolvedValue({ id: 'thread-1' })
    mocks.chatThreadUpdate.mockResolvedValue({})
    mocks.getAggregatedMCPTools.mockResolvedValue({
      KB_doc_query: docQueryTool,
    })
    mocks.getUserCredits.mockResolvedValue({ current: 1, total: 1 })
    mocks.previewUserCredits.mockResolvedValue({ current: 1, total: 1 })
    mocks.decrementCredits.mockResolvedValue({ current: 1, total: 1 })
    mocks.claimChatTurn.mockResolvedValue({
      outcome: 'claimed',
      lifecycleAttemptId: 'attempt-1',
    })
    mocks.failChatTurn.mockResolvedValue(undefined)
    mocks.finalizeChatTurn.mockImplementation(({ rawCreditsUsed }) =>
      Promise.resolve({ outcome: 'completed', creditsUsed: rawCreditsUsed })
    )
    mocks.isChatAccountUsageEnforcementEnabled.mockReturnValue(false)
    mocks.isChatAccountUsageAvailable.mockResolvedValue(true)
    mocks.roundChatUsageCredits.mockImplementation((value) => ({
      toNumber: () => value,
    }))
    mocks.buildPromptCacheRequest.mockResolvedValue(null)
    mocks.listPersonalElements.mockResolvedValue([])
    mocks.isPersonalCardGenerationEnabled.mockResolvedValue(true)
    mocks.createGenerateCardsTool.mockImplementation((options) => {
      mocks.generateToolOptions.push(options)
      return { execute: vi.fn() }
    })
    mocks.toUIMessageStream.mockImplementation(
      (options: { sendFinish?: boolean }) =>
        new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start' })
            if (options.sendFinish !== false) {
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
              })
            }
            controller.close()
          },
        })
    )
    mocks.streamText.mockImplementation(() => ({
      toUIMessageStream: mocks.toUIMessageStream,
    }))
  })

  test('forces retrieval and bounds empty results for an ordinary question', async () => {
    const response = await POST(
      createRequest('What is CAPM?', 'assistant-ordinary'),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    const options = mocks.streamText.mock.calls[0]?.[0] as {
      prepareStep: (input: { stepNumber: number; steps: unknown[] }) => unknown
      stopWhen: unknown
    }

    expect(options.prepareStep({ stepNumber: 0, steps: [] })).toMatchObject({
      activeTools: ['KB_doc_query'],
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
    expect(
      options.prepareStep({ stepNumber: 1, steps: [emptyRetrievalStep()] })
    ).toMatchObject({
      activeTools: ['KB_doc_query'],
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
    const exhaustedStep = options.prepareStep({
      stepNumber: 2,
      steps: [emptyRetrievalStep(), emptyRetrievalStep()],
    }) as {
      activeTools: string[]
      toolChoice: unknown
    }
    expect(exhaustedStep).toMatchObject({
      activeTools: ['course_retrieval_unavailable'],
      toolChoice: {
        type: 'tool',
        toolName: 'course_retrieval_unavailable',
      },
      toolOrder: expect.arrayContaining(['course_retrieval_unavailable']),
    })
    const fallbackTool = (
      options as unknown as {
        tools: Record<string, { execute?: (input: unknown) => unknown }>
      }
    ).tools.course_retrieval_unavailable
    await expect(fallbackTool?.execute?.({})).resolves.toEqual({
      status: 'course_material_unavailable',
    })
    expect(Array.isArray(options.stopWhen)).toBe(true)
  })

  test('hides creation tools when the personal-card capability is disabled', async () => {
    mocks.isPersonalCardGenerationEnabled.mockResolvedValue(false)

    const response = await POST(
      createRequest('Generate flashcards about CAPM.', 'assistant-disabled'),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.createProposeCardPlanTool).not.toHaveBeenCalled()
    expect(mocks.createGenerateCardsTool).not.toHaveBeenCalled()

    const options = mocks.streamText.mock.calls[0]?.[0] as {
      tools: Record<string, unknown>
      prepareStep: (input: { stepNumber: number; steps: unknown[] }) => {
        activeTools: string[]
      }
    }
    expect(options.tools).not.toHaveProperty('propose_card_plan')
    expect(options.tools).not.toHaveProperty('generate_cards')
    expect(options.tools).toHaveProperty('list_personal_elements')
    expect(
      options.prepareStep({ stepNumber: 1, steps: [validRetrievalStep()] })
    ).toEqual({
      activeTools: [
        'KB_doc_query',
        'list_personal_elements',
        'revise_personal_element',
      ],
      toolOrder: [
        'KB_doc_query',
        'list_personal_elements',
        'revise_personal_element',
        'course_retrieval_unavailable',
      ],
    })
  })

  test('emits the finish only after successful response finalization', async () => {
    const response = await POST(
      createRequest('What is CAPM?', 'assistant-success'),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    const streamOptions = mocks.streamText.mock.calls[0]?.[0] as {
      onEnd: (result: unknown) => Promise<void>
    }
    await streamOptions.onEnd({
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      reasoningText: '',
      steps: [
        {
          reasoningText: '',
          content: [{ type: 'text', text: 'A grounded answer.' }],
        },
      ],
    })

    const chunks = await readSseChunks(response)
    expect(chunks.at(-1)).toMatchObject({
      type: 'finish',
      finishReason: 'stop',
      messageMetadata: expect.objectContaining({
        chatMode: 'explainer',
        modelId: 'gpt-4.1',
      }),
    })
  })

  test('fails closed when the UI stream closes without terminal finalization', async () => {
    const response = await POST(
      createRequest('What is CAPM?', 'assistant-no-terminal-callback'),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    const chunks = await readSseChunks(response)
    expect(chunks.some((chunk) => chunk.type === 'finish')).toBe(false)
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(true)
  })

  test('waits for valid chunks before proposing cards and bounds malformed results', async () => {
    const response = await POST(
      createRequest('Generate flashcards about CAPM.', 'assistant-cards'),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    const options = mocks.streamText.mock.calls[0]?.[0] as {
      prepareStep: (input: { stepNumber: number; steps: unknown[] }) => unknown
      stopWhen: unknown
    }

    expect(
      options.prepareStep({ stepNumber: 1, steps: [malformedRetrievalStep()] })
    ).toMatchObject({
      activeTools: ['KB_doc_query'],
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
    expect(
      options.prepareStep({
        stepNumber: 2,
        steps: [malformedRetrievalStep(), malformedRetrievalStep()],
      })
    ).toMatchObject({
      activeTools: ['course_retrieval_unavailable'],
      toolChoice: {
        type: 'tool',
        toolName: 'course_retrieval_unavailable',
      },
    })
    expect(
      options.prepareStep({ stepNumber: 1, steps: [validRetrievalStep()] })
    ).toMatchObject({
      activeTools: ['propose_card_plan'],
      toolChoice: { type: 'tool', toolName: 'propose_card_plan' },
    })
    expect(Array.isArray(options.stopWhen)).toBe(true)
    expect(options.stopWhen).toHaveLength(3)

    const stopConditions = options.stopWhen as Array<
      (input: { steps: unknown[] }) => boolean
    >
    expect(
      stopConditions[0]?.({
        steps: [{ toolCalls: [{ toolName: 'propose_card_plan' }] }],
      })
    ).toBe(true)
    expect(
      stopConditions[0]?.({
        steps: [{ toolCalls: [{ toolName: 'KB_doc_query' }] }],
      })
    ).toBe(false)
    expect(
      stopConditions[1]?.({
        steps: [{ toolCalls: [{ toolName: 'course_retrieval_unavailable' }] }],
      })
    ).toBe(true)
    expect(stopConditions[2]?.({ steps: Array.from({ length: 5 }) })).toBe(true)
    expect(stopConditions[2]?.({ steps: Array.from({ length: 4 }) })).toBe(
      false
    )
  })

  test('passes the complete saved-title list to plan creation', async () => {
    mocks.listPersonalElements.mockResolvedValue([
      {
        name: 'Existing CAPM card',
      },
      {
        name: 'Existing inflation card',
      },
    ])

    const response = await POST(
      createRequest('Generate flashcards about CAPM.', 'assistant-title-list'),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.createProposeCardPlanTool).toHaveBeenCalledWith(
      expect.objectContaining({
        existingCardTitles: ['Existing CAPM card', 'Existing inflation card'],
        getExistingCardTitles: expect.any(Function),
      })
    )
    const options = mocks.streamText.mock.calls[0]?.[0] as {
      instructions?: string
    }
    expect(options.instructions).not.toContain('Existing CAPM card')
    expect(options.instructions).toContain('complete saved-title list')
  })

  test('does not disclose saved titles for ordinary chat', async () => {
    mocks.listPersonalElements.mockResolvedValue([{ name: 'Private title' }])

    const response = await POST(
      createRequest('What is CAPM?', 'assistant-no-title-disclosure'),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.listPersonalElements).not.toHaveBeenCalled()
    expect(mocks.createProposeCardPlanTool).toHaveBeenCalledWith(
      expect.objectContaining({
        existingCardTitles: [],
        getExistingCardTitles: expect.any(Function),
      })
    )
    const planToolOptions = (
      mocks.createProposeCardPlanTool.mock.calls as unknown as Array<
        [{ getExistingCardTitles: () => Promise<readonly string[]> }]
      >
    )[0]![0]
    await expect(planToolOptions.getExistingCardTitles()).resolves.toEqual([
      'Private title',
    ])
    expect(mocks.listPersonalElements).toHaveBeenCalledOnce()
    const options = mocks.streamText.mock.calls[0]?.[0] as {
      instructions?: string
    }
    expect(options.instructions).not.toContain('Private title')
  })

  test('rejects approval when titles duplicate within the approved plan', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000002'
    const planToolCallId = 'plan-tool'
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'CAPM definition',
          intent: 'Define CAPM',
          query: 'CAPM',
        },
        {
          candidateId: 'plan:card-2',
          title: 'CAPM Definition',
          intent: 'Explain CAPM',
          query: 'CAPM definition',
        },
      ])
    )

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for CAPM.',
        'assistant-approval-duplicate',
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('potential duplicate'),
    })
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('rejects approval when a saved card appears after the plan', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000004'
    const planToolCallId = 'plan-tool-existing'
    mocks.listPersonalElements.mockResolvedValue([{ name: 'CAPM definition' }])
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'CAPM definition',
          intent: 'Define CAPM',
          query: 'CAPM',
        },
      ])
    )

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for CAPM.',
        'assistant-approval-stale',
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('potential duplicate'),
    })
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('rejects an accepted plan after a newer plan replaces it', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000007'
    const newerPlanMessageId = '00000000-0000-0000-0000-000000000008'
    const planToolCallId = 'plan-tool-replaced'
    const history = approvedPlanHistory(planMessageId, planToolCallId, [
      {
        candidateId: 'plan:card-1',
        title: 'CAPM definition',
        intent: 'Define CAPM',
        query: 'CAPM',
      },
    ])
    history.push({
      id: newerPlanMessageId,
      parentId: planMessageId,
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'newer-plan-tool',
          toolName: 'propose_card_plan',
          result: {
            planId: '00000000-0000-0000-0000-000000000009',
            topic: 'CAPM revised',
            cards: [],
          },
        },
      ],
      createdAt: new Date('2026-08-24T10:02:00.000Z'),
    })
    mocks.chatMessageFindMany.mockResolvedValue(history)

    const response = await POST(
      createRequest(
        'Please generate the earlier proposed cards.',
        'assistant-replaced-plan',
        {
          parentId: newerPlanMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'This card plan was replaced by a newer plan',
    })
    expect(mocks.claimCardGenerationLease).not.toHaveBeenCalled()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('retries only unresolved cards from a partially decided plan', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000005'
    const planToolCallId = 'plan-tool-retry'
    mocks.listPersonalElements.mockResolvedValue([
      {
        name: 'Rates',
        candidateId: 'plan:card-1',
        sourceMessageId: 'prior-generation-attempt',
        sourceToolCallId: 'prior-generate-tool',
      },
    ])
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          candidateId: 'plan:card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
      ])
    )

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for monetary policy.',
        'assistant-approval-retry',
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    const calls = mocks.createGenerateCardsTool.mock.calls as unknown as Array<
      [{ skipCandidateIds?: ReadonlySet<string> }]
    >
    expect(calls.at(-1)?.[0].skipCandidateIds).toEqual(new Set(['plan:card-1']))
    const options = mocks.streamText.mock.calls[0]?.[0] as {
      instructions: string
      tools: Record<string, unknown>
      prepareStep: (input: { stepNumber: number; steps: unknown[] }) => unknown
    }
    expect(options.instructions).toContain(
      'The student accepted this exact final card plan.'
    )
    expect(options.instructions).toContain(
      'Do not send a text explanation before or after the tool call'
    )
    expect(options.instructions).not.toContain(
      'retrieve course material first, then call propose_card_plan'
    )
    expect(options.tools).not.toHaveProperty('propose_card_plan')
    expect(options.tools).not.toHaveProperty('course_retrieval_unavailable')
    expect(options.prepareStep({ stepNumber: 0, steps: [] })).toMatchObject({
      activeTools: ['generate_cards'],
      toolChoice: { type: 'tool', toolName: 'generate_cards' },
    })
    expect(mocks.claimChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantMessageId: 'assistant-approval-retry',
        parentId: 'user-1',
      })
    )
    expect(mocks.chatMessageCreate).not.toHaveBeenCalled()
    expect(mocks.streamText).toHaveBeenCalledOnce()
  })

  test('releases an accepted-plan lease when setup fails before streaming', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000010'
    const planToolCallId = 'plan-tool-setup-failure'
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'CAPM definition',
          intent: 'Define CAPM',
          query: 'CAPM',
        },
      ])
    )
    mocks.buildPromptCacheRequest.mockRejectedValueOnce(
      new Error('synthetic prompt-cache failure')
    )

    await expect(
      POST(
        createRequest(
          'Please generate the proposed cards for CAPM.',
          'assistant-setup-failure',
          {
            parentId: planMessageId,
            approvedPlan: {
              messageId: planMessageId,
              toolCallId: planToolCallId,
            },
          }
        ),
        { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
      )
    ).rejects.toThrow('synthetic prompt-cache failure')

    expect(mocks.abortCardGenerationLease).toHaveBeenCalledOnce()
    expect(mocks.streamText).not.toHaveBeenCalled()
  })

  test('deletes a lost-lease response after charging nested generation once', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000011'
    const planToolCallId = 'plan-tool-lost'
    const assistantMessageId = 'assistant-lost-lease'
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ])
    )
    mocks.completeCardGenerationLease.mockResolvedValue(false)

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for monetary policy.',
        assistantMessageId,
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.generateToolOptions).toHaveLength(1)
    mocks.generateToolOptions[0]!.onNestedUsage({ inputTokens: 1_000_000 })
    const streamOptions = mocks.streamText.mock.calls[0]?.[0] as {
      onEnd: (result: unknown) => Promise<void>
    }
    await streamOptions.onEnd({
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      reasoningText: '',
      steps: [
        {
          reasoningText: '',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'generate-lost',
              toolName: 'generate_cards',
              input: {},
            },
            {
              type: 'tool-result',
              toolCallId: 'generate-lost',
              toolName: 'generate_cards',
              output: { status: 'completed', candidates: [] },
            },
          ],
        },
      ],
    })

    expect(mocks.finalizeChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantMessageId,
        rawCreditsUsed: 2,
      })
    )
    expect(mocks.completeCardGenerationLease).toHaveBeenCalledOnce()
    expect(mocks.chatMessageDeleteMany).toHaveBeenCalledWith({
      where: {
        id: assistantMessageId,
        threadId: 'thread-1',
        role: 'assistant',
      },
    })
    expect(mocks.decrementCredits).toHaveBeenCalledOnce()
    expect(mocks.decrementCredits).toHaveBeenCalledWith(
      'participant-1',
      'chatbot-1',
      2
    )
    const chunks = await readSseChunks(response)
    expect(chunks.some((chunk) => chunk.type === 'finish')).toBe(false)
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(true)
  })

  test('deletes a response when lease completion fails', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000012'
    const planToolCallId = 'plan-tool-failed-settlement'
    const assistantMessageId = 'assistant-failed-settlement'
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ])
    )
    mocks.completeCardGenerationLease.mockRejectedValue(
      new Error('database unavailable')
    )

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for monetary policy.',
        assistantMessageId,
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    const streamOptions = mocks.streamText.mock.calls[0]?.[0] as {
      onEnd: (result: unknown) => Promise<void>
    }
    await streamOptions.onEnd({
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      reasoningText: '',
      steps: [
        {
          reasoningText: '',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'generate-failed-settlement',
              toolName: 'generate_cards',
              input: {},
            },
            {
              type: 'tool-result',
              toolCallId: 'generate-failed-settlement',
              toolName: 'generate_cards',
              output: { status: 'completed', candidates: [] },
            },
          ],
        },
      ],
    })

    expect(mocks.chatMessageDeleteMany).toHaveBeenCalledWith({
      where: {
        id: assistantMessageId,
        threadId: 'thread-1',
        role: 'assistant',
      },
    })
    expect(mocks.completeCardGenerationLease).toHaveBeenCalledOnce()
    expect(mocks.abortCardGenerationLease).toHaveBeenCalledOnce()
    const chunks = await readSseChunks(response)
    expect(chunks.some((chunk) => chunk.type === 'finish')).toBe(false)
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(true)
  })

  test('fails closed when the assistant message cannot be persisted', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000013'
    const planToolCallId = 'plan-tool-aborted-settlement'
    const assistantMessageId = 'assistant-aborted-settlement'
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ])
    )
    mocks.finalizeChatTurn.mockRejectedValueOnce(
      new Error('Assistant message could not be persisted')
    )

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for monetary policy.',
        assistantMessageId,
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    const streamOptions = mocks.streamText.mock.calls[0]?.[0] as {
      onEnd: (result: unknown) => Promise<void>
    }
    await streamOptions.onEnd({
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      reasoningText: '',
      steps: [
        {
          reasoningText: '',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'generate-aborted-settlement',
              toolName: 'generate_cards',
              input: {},
            },
            {
              type: 'tool-result',
              toolCallId: 'generate-aborted-settlement',
              toolName: 'generate_cards',
              output: { status: 'completed', candidates: [] },
            },
          ],
        },
      ],
    })

    expect(mocks.abortCardGenerationLease).toHaveBeenCalledOnce()
    const chunks = await readSseChunks(response)
    expect(chunks.some((chunk) => chunk.type === 'finish')).toBe(false)
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(true)
  })

  test('keeps terminal partial cards available after intentional lease abort', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000014'
    const planToolCallId = 'plan-tool-partial'
    const assistantMessageId = 'assistant-partial'
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          candidateId: 'plan:card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
      ])
    )

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for monetary policy.',
        assistantMessageId,
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    const streamOptions = mocks.streamText.mock.calls[0]?.[0] as {
      onEnd: (result: unknown) => Promise<void>
    }
    await streamOptions.onEnd({
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      reasoningText: '',
      steps: [
        {
          reasoningText: '',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'generate-partial',
              toolName: 'generate_cards',
              input: {},
            },
            {
              type: 'tool-result',
              toolCallId: 'generate-partial',
              toolName: 'generate_cards',
              output: {
                status: 'partial',
                completed: 2,
                total: 2,
                candidates: [{ candidateId: 'plan:card-1' }],
                failedCards: [
                  { candidateId: 'plan:card-2', code: 'retrieval_unavailable' },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(mocks.abortCardGenerationLease).toHaveBeenCalledOnce()
    expect(mocks.chatMessageDeleteMany).not.toHaveBeenCalled()
    const chunks = await readSseChunks(response)
    expect(chunks.some((chunk) => chunk.type === 'finish')).toBe(true)
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(false)
  })

  test('skips discarded cards from an earlier generation attempt', async () => {
    const planMessageId = '00000000-0000-0000-0000-000000000006'
    const planToolCallId = 'plan-tool-discard-retry'
    mocks.listDiscardedCandidateIds.mockResolvedValue(['plan:card-1'])
    mocks.chatMessageFindMany.mockResolvedValue(
      approvedPlanHistory(planMessageId, planToolCallId, [
        {
          candidateId: 'plan:card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          candidateId: 'plan:card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
      ])
    )

    const response = await POST(
      createRequest(
        'Please generate the proposed cards for monetary policy.',
        'assistant-approval-discard-retry',
        {
          parentId: planMessageId,
          approvedPlan: {
            messageId: planMessageId,
            toolCallId: planToolCallId,
          },
        }
      ),
      { params: Promise.resolve({ chatbotId: 'chatbot-1' }) }
    )

    expect(response.status).toBe(200)
    const calls = mocks.createGenerateCardsTool.mock.calls as unknown as Array<
      [{ skipCandidateIds?: ReadonlySet<string> }]
    >
    expect(calls.at(-1)?.[0].skipCandidateIds).toEqual(new Set(['plan:card-1']))
    expect(mocks.listDiscardedCandidateIds).toHaveBeenCalledWith({
      participantId: 'participant-1',
      courseId: 'course-1',
      candidateIds: ['plan:card-1', 'plan:card-2'],
    })
  })
})
