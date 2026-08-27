import { beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  listPersonalElements: vi.fn(),
  listDiscardedCandidateIds: vi.fn(),
  listCompletedGenerationLeaseAttemptTokens: vi.fn(),
  claimLease: vi.fn(),
  completeLease: vi.fn(),
  abortLease: vi.fn(),
  createAttemptMessage: vi.fn(),
  isPersonalCardGenerationEnabled: vi.fn(),
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  listPersonalElements: mocks.listPersonalElements,
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
  createGenerateCardsTool: vi.fn(() => ({ execute: vi.fn() })),
  createListPersonalElementsTool: vi.fn(() => ({ execute: vi.fn() })),
  createProposeCardPlanTool: vi.fn(() => ({ execute: vi.fn() })),
  createRevisePersonalElementTool: vi.fn(() => ({ execute: vi.fn() })),
}))

vi.mock('../src/lib/server/personalElements/featureFlag', () => ({
  isPersonalCardGenerationEnabled: mocks.isPersonalCardGenerationEnabled,
}))

import { createCardGeneration } from '../src/lib/server/personalElements/cardGeneration'

const retrieval = {
  sources: [
    {
      file_name: 'Lecture 1',
      chunks: [{ chunk_id: 'chunk-1', content: 'Synthetic evidence.' }],
    },
  ],
}

const emptyRetrieval = { sources: [] }

function createPrisma() {
  return {
    course: { findUnique: vi.fn().mockResolvedValue({ language: 'en' }) },
    chatMessage: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as never
}

async function createSetup({
  latestUserContent = 'Explain CAPM',
  hasImage = false,
  hasGenerationCredits = true,
}: {
  latestUserContent?: string
  hasImage?: boolean
  hasGenerationCredits?: boolean
} = {}) {
  const result = await createCardGeneration({
    prisma: createPrisma(),
    participantId: 'participant-1',
    chatbotId: 'chatbot-1',
    courseId: 'course-1',
    threadId: 'thread-1',
    activeBranchLeafId: null,
    attemptParentMessageId: 'user-1',
    assistantMessageId: 'assistant-1',
    threadHistory: [],
    baseTools: {
      KB_doc_query: {
        description: 'Search course material.',
        inputSchema: z.object({ query: z.string() }),
        execute: vi.fn(),
      },
    },
    model: {} as never,
    systemPrompt: 'Use course material.',
    latestUserContent,
    hasImage,
    hasGenerationCredits,
    calculateNestedCost: () => 0,
  })
  if (!result.ok) throw new Error(result.error)
  return result
}

function retrievedStep() {
  return {
    toolResults: [
      { type: 'tool-result', toolName: 'KB_doc_query', result: retrieval },
    ],
  }
}

function failedRetrievalStep() {
  return {
    toolResults: [
      {
        type: 'tool-result',
        toolName: 'KB_doc_query',
        result: emptyRetrieval,
      },
    ],
  }
}

describe('retrieval protocol state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listPersonalElements.mockResolvedValue([])
    mocks.listDiscardedCandidateIds.mockResolvedValue([])
    mocks.listCompletedGenerationLeaseAttemptTokens.mockResolvedValue([])
    mocks.claimLease.mockResolvedValue({
      id: 'lease-1',
      attemptToken: 'assistant-1',
    })
    mocks.completeLease.mockResolvedValue(true)
    mocks.abortLease.mockResolvedValue(true)
    mocks.createAttemptMessage.mockResolvedValue(undefined)
    mocks.isPersonalCardGenerationEnabled.mockResolvedValue(true)
  })

  test.each([
    'Explain CAPM',
    'Erkläre mir den Beta-Faktor',
    '请解释资本资产定价模型',
    'اشرح نموذج تسعير الأصول الرأسمالية',
    '👋',
  ])('forces retrieval for any non-empty text turn: %s', async (content) => {
    const setup = await createSetup({ latestUserContent: content })

    expect(setup.telemetry.retrievalRequired).toBe(true)
    expect(setup.prepareStep({ stepNumber: 0, steps: [] })).toMatchObject({
      activeTools: ['KB_doc_query'],
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
  })

  test('forces retrieval for an image turn without text', async () => {
    const setup = await createSetup({ latestUserContent: '', hasImage: true })

    expect(setup.telemetry.retrievalRequired).toBe(true)
    expect(setup.prepareStep({ stepNumber: 0, steps: [] })).toMatchObject({
      activeTools: ['KB_doc_query'],
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
  })

  test.each([
    '',
    '   ',
  ])('does not force retrieval for an empty turn: %j', async (content) => {
    const setup = await createSetup({ latestUserContent: content })
    const step = setup.prepareStep({ stepNumber: 0, steps: [] })

    expect(setup.telemetry.retrievalRequired).toBe(false)
    expect(step.toolChoice).toBeUndefined()
    expect(step.activeTools as string[]).not.toContain('propose_card_plan')
  })

  test('unlocks grounded tools and propose_card_plan only after retrieval succeeds', async () => {
    const setup = await createSetup()

    const before = setup.prepareStep({ stepNumber: 0, steps: [] })
    expect(before).toMatchObject({
      activeTools: ['KB_doc_query'],
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
    expect(before.activeTools).not.toContain('propose_card_plan')

    const after = setup.prepareStep({ stepNumber: 1, steps: [retrievedStep()] })
    expect(after.activeTools).toEqual(
      expect.arrayContaining([
        'KB_doc_query',
        'list_personal_elements',
        'revise_personal_element',
        'propose_card_plan',
      ])
    )
  })

  test('keeps planning locked after a failed retrieval', async () => {
    const setup = await createSetup()

    const after = setup.prepareStep({
      stepNumber: 1,
      steps: [failedRetrievalStep()],
    })
    expect(after).toMatchObject({
      activeTools: ['KB_doc_query'],
      toolChoice: { type: 'tool', toolName: 'KB_doc_query' },
    })
    expect(after.activeTools).not.toContain('propose_card_plan')
  })

  test('forces the terminal retrieval-unavailable tool after the allowed attempts', async () => {
    const setup = await createSetup()

    const terminal = setup.prepareStep({
      stepNumber: 2,
      steps: [failedRetrievalStep(), failedRetrievalStep()],
    })
    expect(terminal).toMatchObject({
      activeTools: ['course_retrieval_unavailable'],
      toolChoice: {
        type: 'tool',
        toolName: 'course_retrieval_unavailable',
      },
    })
  })

  test('does not unlock propose_card_plan without generation eligibility', async () => {
    const setup = await createSetup({ hasGenerationCredits: false })

    const after = setup.prepareStep({ stepNumber: 1, steps: [retrievedStep()] })
    expect(after.activeTools).not.toContain('propose_card_plan')
    expect(setup.telemetry.generationEligible).toBe(false)
  })

  test('ends the turn on propose_card_plan whenever generation is eligible', async () => {
    const setup = await createSetup()
    const stopWhen = Array.isArray(setup.stopWhen)
      ? setup.stopWhen
      : [setup.stopWhen]

    expect(
      stopWhen.some((condition) =>
        condition({
          steps: [
            {
              toolCalls: [{ toolName: 'propose_card_plan' }],
            },
          ],
        } as never)
      )
    ).toBe(true)
  })

  test('keeps the retrieval-unavailable and step-count stops in every mode', async () => {
    const setup = await createSetup()
    const stopWhen = Array.isArray(setup.stopWhen)
      ? setup.stopWhen
      : [setup.stopWhen]

    expect(
      stopWhen.some((condition) =>
        condition({
          steps: [
            {
              toolCalls: [{ toolName: 'course_retrieval_unavailable' }],
            },
          ],
        } as never)
      )
    ).toBe(true)
    expect(
      stopWhen.some((condition) =>
        condition({
          steps: Array.from({ length: 5 }, () => ({ toolCalls: [] })),
        } as never)
      )
    ).toBe(true)
  })

  test('does not stop on propose_card_plan without generation eligibility', async () => {
    const setup = await createSetup({ hasGenerationCredits: false })
    const stopWhen = Array.isArray(setup.stopWhen)
      ? setup.stopWhen
      : [setup.stopWhen]

    expect(
      stopWhen.some((condition) =>
        condition({
          steps: [
            {
              toolCalls: [{ toolName: 'propose_card_plan' }],
            },
          ],
        } as never)
      )
    ).toBe(false)
  })

  test('keeps planning and generation unavailable without a doc_query tool', async () => {
    const result = await createCardGeneration({
      prisma: createPrisma(),
      participantId: 'participant-1',
      chatbotId: 'chatbot-1',
      courseId: 'course-1',
      threadId: 'thread-1',
      activeBranchLeafId: null,
      attemptParentMessageId: 'user-1',
      assistantMessageId: 'assistant-1',
      threadHistory: [],
      baseTools: {},
      model: {} as never,
      systemPrompt: 'Use course material.',
      latestUserContent: 'Explain CAPM',
      hasImage: false,
      hasGenerationCredits: true,
      calculateNestedCost: () => 0,
    })
    if (!result.ok) throw new Error(result.error)

    expect(result.telemetry.personalToolsEligible).toBe(false)
    expect(result.telemetry.generationEligible).toBe(false)
    expect(result.tools).not.toHaveProperty('propose_card_plan')
    expect(result.tools).not.toHaveProperty('generate_cards')
    const step = result.prepareStep({ stepNumber: 0, steps: [] })
    expect(step.activeTools).not.toContain('propose_card_plan')
  })
})
