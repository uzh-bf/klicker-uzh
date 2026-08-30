import { beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  getPersonalElementGenerationContext: vi.fn(),
  listPersonalElements: vi.fn(),
  listSavedPersonalElementCandidateIds: vi.fn(),
  listDiscardedCandidateIds: vi.fn(),
  listCompletedGenerationLeaseAttemptTokens: vi.fn(),
  claimLease: vi.fn(),
  completeLease: vi.fn(),
  abortLease: vi.fn(),
  createAttemptMessage: vi.fn(),
  isPersonalCardGenerationEnabled: vi.fn(),
  generateToolOptions: [] as Array<{
    onNestedUsage: (usage: {
      inputTokens?: number
      outputTokens?: number
    }) => void
  }>,
  reviseToolOptions: [] as Array<{
    onNestedUsage: (usage: {
      inputTokens?: number
      outputTokens?: number
    }) => void
  }>,
  updateAssistantMessage: vi.fn(),
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  getPersonalElementGenerationContext:
    mocks.getPersonalElementGenerationContext,
  listPersonalElements: mocks.listPersonalElements,
  listSavedPersonalElementCandidateIds:
    mocks.listSavedPersonalElementCandidateIds,
  prepareCardPlan: vi.fn(),
  validateCardCandidate: vi.fn().mockResolvedValue(true),
  listDiscardedCandidateIds: mocks.listDiscardedCandidateIds,
  listCompletedGenerationLeaseAttemptTokens:
    mocks.listCompletedGenerationLeaseAttemptTokens,
}))

vi.mock('../src/lib/server/personalElements/lease', () => ({
  claimGenerationLease: mocks.claimLease,
  completeGenerationLease: mocks.completeLease,
  abortGenerationLease: mocks.abortLease,
  createGenerationAttemptMessage: mocks.createAttemptMessage,
}))

vi.mock('../src/lib/server/personalElements/tools', () => ({
  createGenerateCardsTool: vi.fn((options) => {
    mocks.generateToolOptions.push(options)
    return { execute: vi.fn() }
  }),
  createListPersonalElementsTool: vi.fn(() => ({ execute: vi.fn() })),
  createProposeCardPlanTool: vi.fn(() => ({ execute: vi.fn() })),
  createRevisePersonalElementTool: vi.fn((options) => {
    mocks.reviseToolOptions.push(options)
    return { execute: vi.fn() }
  }),
}))

vi.mock('../src/lib/server/personalElements/featureFlag', () => ({
  isPersonalCardGenerationEnabled: mocks.isPersonalCardGenerationEnabled,
}))

import { createCardGeneration } from '../src/lib/server/personalElements/cardGeneration'

const planMessageId = '00000000-0000-0000-0000-000000000001'
const planToolCallId = 'plan-tool-1'
const plan = {
  planId: '00000000-0000-0000-0000-000000000002',
  topic: 'CAPM',
  cards: [
    {
      type: 'FLASHCARD' as const,
      candidateId: 'plan-1:card-1',
      title: 'CAPM definition',
      intent: 'Define CAPM',
      query: 'CAPM definition',
    },
  ],
}
const retrieval = {
  sources: [
    {
      file_name: 'Lecture 1',
      chunks: [{ chunk_id: 'chunk-1', content: 'Synthetic evidence.' }],
    },
  ],
}
const threadHistory = [
  {
    id: 'user-1',
    parentId: null,
    role: 'user',
    content: 'Generate cards.',
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
        result: plan,
      },
      {
        type: 'tool-result',
        toolName: 'KB_doc_query',
        output: retrieval,
      },
    ],
    createdAt: new Date('2026-08-24T10:01:00.000Z'),
  },
]

function createPrisma() {
  return {
    course: { findUnique: vi.fn().mockResolvedValue({ language: 'en' }) },
    chatMessage: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: mocks.updateAssistantMessage,
    },
  } as never
}

function createSetupOptions(
  calculateNestedCost: (usage: {
    inputTokens?: number
    outputTokens?: number
  }) => number = () => 0,
  evaluateCardGeneration?: (target: {
    participantId: string
    chatbotId: string
  }) => boolean | Promise<boolean>
) {
  return {
    prisma: createPrisma(),
    participantId: 'participant-1',
    chatbotId: 'chatbot-1',
    courseId: 'course-1',
    threadId: 'thread-1',
    activeBranchLeafId: planMessageId,
    attemptParentMessageId: 'user-2',
    assistantMessageId: 'assistant-attempt-1',
    threadHistory,
    acceptedPlanReference: {
      messageId: planMessageId,
      toolCallId: planToolCallId,
    },
    baseTools: {
      KB_doc_query: {
        description: 'Search course material.',
        inputSchema: z.object({ query: z.string() }),
        execute: vi.fn(),
      },
    },
    model: {} as never,
    systemPrompt: 'Use course material.',
    latestUserContent: 'Generate the accepted cards.',
    hasImage: false,
    hasGenerationCredits: true,
    calculateNestedCost,
    evaluateCardGeneration,
  }
}

async function createSetupResult(
  calculateNestedCost: (usage: {
    inputTokens?: number
    outputTokens?: number
  }) => number = () => 0,
  evaluateCardGeneration?: (target: {
    participantId: string
    chatbotId: string
  }) => boolean | Promise<boolean>
) {
  return createCardGeneration(
    createSetupOptions(calculateNestedCost, evaluateCardGeneration)
  )
}

async function createSetup(
  calculateNestedCost: (usage: {
    inputTokens?: number
    outputTokens?: number
  }) => number = () => 0,
  evaluateCardGeneration?: (target: {
    participantId: string
    chatbotId: string
  }) => boolean | Promise<boolean>
) {
  const result = await createSetupResult(
    calculateNestedCost,
    evaluateCardGeneration
  )
  if (!result.ok) throw new Error(result.error)
  return result
}

describe('personal card generation orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateToolOptions.length = 0
    mocks.reviseToolOptions.length = 0
    mocks.updateAssistantMessage.mockResolvedValue({ count: 1 })
    mocks.listPersonalElements.mockResolvedValue([])
    mocks.getPersonalElementGenerationContext.mockResolvedValue({
      courseLanguage: 'en',
      existingTitles: [],
    })
    mocks.listSavedPersonalElementCandidateIds.mockResolvedValue([])
    mocks.listDiscardedCandidateIds.mockResolvedValue([])
    mocks.listCompletedGenerationLeaseAttemptTokens.mockResolvedValue([])
    mocks.claimLease.mockResolvedValue({
      id: 'lease-1',
      attemptToken: 'assistant-attempt-1',
    })
    mocks.completeLease.mockResolvedValue(true)
    mocks.abortLease.mockResolvedValue(true)
    mocks.createAttemptMessage.mockResolvedValue(undefined)
    mocks.isPersonalCardGenerationEnabled.mockResolvedValue(true)
  })

  test('completes a successful attempt only once', async () => {
    const setup = await createSetup()
    const content = [
      {
        type: 'tool-call',
        toolName: 'generate_cards',
        result: { status: 'completed', candidates: [] },
      },
    ]

    await expect(
      setup.settleLease({
        assistantMessagePersisted: true,
        assistantMessageContent: content,
      })
    ).resolves.toEqual({ status: 'completed' })
    await expect(
      setup.settleLease({
        assistantMessagePersisted: true,
        assistantMessageContent: content,
      })
    ).resolves.toEqual({ status: 'none' })
    await setup.abortLease()

    expect(mocks.completeLease).toHaveBeenCalledOnce()
    expect(mocks.abortLease).not.toHaveBeenCalled()
  })

  test.each([
    {
      name: 'failed',
      result: { status: 'error', candidates: [] },
    },
    {
      name: 'terminal partial',
      result: {
        status: 'partial',
        completed: 2,
        total: 2,
        candidates: [{ candidateId: 'plan-1:card-1' }],
        failedCards: [
          { candidateId: 'plan-1:card-2', code: 'retrieval_unavailable' },
        ],
      },
    },
  ])('aborts a $name attempt only once', async ({ result }) => {
    const setup = await createSetup()
    const input = {
      assistantMessagePersisted: true,
      assistantMessageContent: [
        { type: 'tool-call', toolName: 'generate_cards', result },
      ],
    }

    await expect(setup.settleLease(input)).resolves.toEqual(
      result.status === 'partial'
        ? { status: 'partial' }
        : { status: 'aborted', reason: 'generation-failed' }
    )
    await expect(setup.settleLease(input)).resolves.toEqual({ status: 'none' })
    await setup.abortLease()

    expect(mocks.abortLease).toHaveBeenCalledOnce()
    expect(mocks.completeLease).not.toHaveBeenCalled()
    if (result.status === 'partial') {
      expect(mocks.updateAssistantMessage).toHaveBeenCalledWith({
        where: { id: 'assistant-attempt-1', threadId: 'thread-1' },
        data: {
          content: expect.arrayContaining([
            expect.objectContaining({
              result: expect.objectContaining({ settlement: 'partial' }),
            }),
          ]),
        },
      })
    } else {
      expect(mocks.updateAssistantMessage).not.toHaveBeenCalled()
    }
  })

  test('reports lost ownership once when completion is rejected', async () => {
    mocks.completeLease.mockResolvedValue(false)
    const setup = await createSetup()
    const input = {
      assistantMessagePersisted: true,
      assistantMessageContent: [],
    }

    await expect(setup.settleLease(input)).resolves.toEqual({ status: 'lost' })
    await expect(setup.settleLease(input)).resolves.toEqual({ status: 'none' })

    expect(mocks.completeLease).toHaveBeenCalledOnce()
    expect(mocks.abortLease).not.toHaveBeenCalled()
  })

  test('reports lost ownership when a terminal partial abort is rejected', async () => {
    mocks.abortLease.mockResolvedValue(false)
    const setup = await createSetup()
    const input = {
      assistantMessagePersisted: true,
      assistantMessageContent: [
        {
          type: 'tool-call',
          toolName: 'generate_cards',
          result: {
            status: 'partial',
            completed: 2,
            total: 2,
            candidates: [{ candidateId: 'plan-1:card-1' }],
            failedCards: [
              { candidateId: 'plan-1:card-2', code: 'retrieval_unavailable' },
            ],
          },
        },
      ],
    }

    await expect(setup.settleLease(input)).resolves.toEqual({ status: 'lost' })
    await expect(setup.settleLease(input)).resolves.toEqual({ status: 'none' })

    expect(mocks.abortLease).toHaveBeenCalledOnce()
    expect(mocks.completeLease).not.toHaveBeenCalled()
    expect(mocks.updateAssistantMessage).not.toHaveBeenCalled()
  })

  test('fails closed and aborts when completion throws', async () => {
    mocks.completeLease.mockRejectedValue(new Error('database unavailable'))
    const setup = await createSetup()
    const input = {
      assistantMessagePersisted: true,
      assistantMessageContent: [],
    }

    await expect(setup.settleLease(input)).resolves.toEqual({
      status: 'failed',
    })
    await expect(setup.settleLease(input)).resolves.toEqual({ status: 'none' })

    expect(mocks.completeLease).toHaveBeenCalledOnce()
    expect(mocks.abortLease).toHaveBeenCalledOnce()
  })

  test('makes an explicit abort terminal and idempotent', async () => {
    const setup = await createSetup()

    await setup.abortLease()
    await setup.abortLease()
    await expect(
      setup.settleLease({
        assistantMessagePersisted: true,
        assistantMessageContent: [],
      })
    ).resolves.toEqual({ status: 'none' })

    expect(mocks.abortLease).toHaveBeenCalledOnce()
    expect(mocks.completeLease).not.toHaveBeenCalled()
  })

  test('does not generate after the creation capability is disabled', async () => {
    const result = await createSetupResult(
      () => 0,
      vi.fn().mockResolvedValue(false)
    )

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Card generation is unavailable for this request',
    })
    expect(mocks.claimLease).not.toHaveBeenCalled()
    expect(mocks.generateToolOptions).toHaveLength(0)
  })

  test('accumulates each nested usage once and exposes a pure cost getter', async () => {
    const calculateNestedCost = vi.fn(
      (usage: { inputTokens?: number; outputTokens?: number }) =>
        (usage.inputTokens ?? 0) * 10 + (usage.outputTokens ?? 0)
    )
    const setup = await createSetup(calculateNestedCost)

    mocks.reviseToolOptions[0]!.onNestedUsage({
      inputTokens: 2,
      outputTokens: 3,
    })
    mocks.generateToolOptions[0]!.onNestedUsage({
      inputTokens: 1,
      outputTokens: 4,
    })

    expect(setup.getNestedGenerationCost()).toBe(37)
    expect(setup.getNestedGenerationCost()).toBe(37)
    expect(calculateNestedCost).toHaveBeenCalledTimes(2)
  })
})
