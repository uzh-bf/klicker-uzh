import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(
  '../src/services/questionGenerationGraph.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../src/services/questionGenerationGraph.js')
      >()
    return {
      ...actual,
      assertQuestionGenerationPreviewAccess: vi.fn(async () => undefined),
    }
  }
)

vi.mock('../src/services/elements.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/services/elements.js')>()
  return { ...actual, manipulateElement: vi.fn() }
})

import { keepGeneratedElementDraft } from '../src/services/elementGeneration.js'
import { manipulateElement } from '../src/services/elements.js'

const ownerId = '123e4567-e89b-42d3-a456-426614174000'
const buildId = '223e4567-e89b-42d3-a456-426614174000'
const draftId = '323e4567-e89b-42d3-a456-426614174000'
const savedAt = new Date('2026-08-29T10:00:00.000Z')

const current = {
  itemType: 'SC' as const,
  name: 'Edited question',
  stem: 'Which answer is correct?',
  context: null,
  explanation: 'A is correct.',
  choices: [
    {
      id: 'choice-a',
      label: 'A',
      text: 'Answer A',
      correct: true,
      feedback: null,
    },
    {
      id: 'choice-b',
      label: 'B',
      text: 'Answer B',
      correct: false,
      feedback: null,
    },
  ],
}

const input = {
  draftId,
  expectedRevision: 2,
  status: DB.ElementStatus.REVIEW,
  type: DB.ElementType.SC,
  name: current.name,
  content: current.stem,
  explanation: current.explanation,
  basePoints: true,
  pointsMultiplier: 2,
  tags: ['generated'],
  options: {
    displayMode: DisplayMode.LIST,
    hasSampleSolution: true,
    hasAnswerFeedbacks: false,
    choices: current.choices.map((choice, ix) => ({
      ix,
      value: choice.text,
      correct: choice.correct,
      feedback: choice.feedback,
    })),
  },
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: draftId,
    buildId,
    sourceElementId: 'source-1',
    order: 0,
    duplicationIndex: 0,
    elementType: DB.ElementType.SC,
    parentDraftId: null,
    original: current,
    current,
    revision: 2,
    decision: DB.GeneratedElementDecision.OPEN,
    bloomLevel: 'understand',
    targetDifficulty: 3,
    predictedDifficulty: null,
    qualityFlags: [],
    citations: [],
    provenance: null,
    savedElementId: null,
    savedAt: null,
    createdAt: savedAt,
    updatedAt: savedAt,
    build: { status: DB.ElementGenerationBuildStatus.COMPLETED },
    ...overrides,
  }
}

function savedElement() {
  return {
    id: 91,
    type: DB.ElementType.SC,
    status: DB.ElementStatus.REVIEW,
    name: current.name,
    content: current.stem,
    explanation: current.explanation,
    basePoints: true,
    pointsMultiplier: 2,
    difficultyLevel: 3,
    options: {
      ...input.options,
      choices: input.options.choices.map((choice) => ({
        ix: choice.ix,
        value: choice.value,
        correct: choice.correct,
      })),
    },
    tags: [{ name: 'generated' }],
  }
}

function context(fullDraft: ReturnType<typeof draft>) {
  const findFirst = vi
    .fn()
    .mockResolvedValueOnce({ buildId })
    .mockResolvedValueOnce(fullDraft)
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    generatedElementDraft: {
      findFirst,
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => ({
        ...fullDraft,
        current,
        revision: 3,
        decision: DB.GeneratedElementDecision.ACCEPTED,
        savedElementId: 91,
        savedAt,
      })),
    },
  }
  return {
    transaction,
    ctx: {
      user: { sub: ownerId },
      prisma: {
        $transaction: vi.fn(async (callback) => callback(transaction)),
      },
    },
  }
}

describe('atomic generated-element keep', () => {
  beforeEach(() => {
    vi.mocked(manipulateElement).mockReset()
  })

  it('creates and links exactly the visible edited element in one transaction', async () => {
    const { ctx, transaction } = context(draft())
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await expect(
      keepGeneratedElementDraft(input, ctx as never)
    ).resolves.toMatchObject({
      revision: 3,
      decision: DB.GeneratedElementDecision.ACCEPTED,
      savedElementId: 91,
    })

    expect(manipulateElement).toHaveBeenCalledOnce()
    expect(manipulateElement).toHaveBeenCalledWith(
      expect.objectContaining({
        status: DB.ElementStatus.REVIEW,
        type: DB.ElementType.SC,
        name: current.name,
        content: current.stem,
        basePoints: true,
        pointsMultiplier: 2,
        tags: ['generated'],
      }),
      expect.objectContaining({ prisma: transaction })
    )
    expect(transaction.generatedElementDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: draftId,
        revision: 2,
        decision: DB.GeneratedElementDecision.OPEN,
        savedElementId: null,
      },
      data: {
        current,
        revision: { increment: 1 },
        decision: DB.GeneratedElementDecision.ACCEPTED,
        savedElementId: 91,
        savedAt: expect.any(Date),
      },
    })
  })

  it('returns the linked element for an exact retry without creating a duplicate', async () => {
    const existing = draft({
      revision: 3,
      decision: DB.GeneratedElementDecision.ACCEPTED,
      savedElementId: 91,
      savedAt,
    })
    const { ctx, transaction } = context(existing)

    await expect(
      keepGeneratedElementDraft(input, ctx as never)
    ).resolves.toMatchObject({ savedElementId: 91 })
    expect(manipulateElement).not.toHaveBeenCalled()
    expect(transaction.generatedElementDraft.updateMany).not.toHaveBeenCalled()
  })

  it('links a legacy accepted draft that has not created an element yet', async () => {
    const { ctx, transaction } = context(
      draft({ decision: DB.GeneratedElementDecision.ACCEPTED })
    )
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await expect(
      keepGeneratedElementDraft(input, ctx as never)
    ).resolves.toMatchObject({ savedElementId: 91 })

    expect(manipulateElement).toHaveBeenCalledOnce()
    expect(transaction.generatedElementDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          decision: DB.GeneratedElementDecision.ACCEPTED,
        }),
      })
    )
  })

  it('keeps a Flashcard with its generation card type and selected status', async () => {
    const flashcard = {
      name: 'Definition',
      front: 'What is atomicity?',
      back: 'A transaction either completes fully or has no effect.',
      cardType: 'definition' as const,
      tags: ['generated-flashcard', 'flashcard:definition'],
    }
    const { ctx, transaction } = context(
      draft({
        elementType: DB.ElementType.FLASHCARD,
        original: flashcard,
        current: flashcard,
        targetDifficulty: null,
      })
    )
    vi.mocked(manipulateElement).mockResolvedValue({ id: 92 } as never)

    await keepGeneratedElementDraft(
      {
        draftId,
        expectedRevision: 2,
        status: DB.ElementStatus.DRAFT,
        type: DB.ElementType.FLASHCARD,
        name: flashcard.name,
        content: flashcard.front,
        explanation: flashcard.back,
        basePoints: false,
        pointsMultiplier: 1,
        tags: ['edited-flashcard'],
      },
      ctx as never
    )

    expect(manipulateElement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DB.ElementType.FLASHCARD,
        status: DB.ElementStatus.DRAFT,
        tags: [
          'generated-flashcard',
          'flashcard:definition',
          'edited-flashcard',
        ],
      }),
      expect.objectContaining({ prisma: transaction })
    )
    expect(transaction.generatedElementDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          current: {
            ...flashcard,
            tags: [
              'generated-flashcard',
              'flashcard:definition',
              'edited-flashcard',
            ],
          },
          decision: DB.GeneratedElementDecision.ACCEPTED,
          savedElementId: 92,
        }),
      })
    )
  })

  it('uses the ordinary Element option contract when keeping an MC draft', async () => {
    const mcCurrent = {
      ...current,
      itemType: 'MC' as const,
      choices: [
        ...current.choices,
        {
          id: 'choice-c',
          label: 'C',
          text: 'Answer C',
          correct: true,
          feedback: null,
        },
      ],
    }
    const { ctx, transaction } = context(
      draft({
        elementType: DB.ElementType.MC,
        original: mcCurrent,
        current: mcCurrent,
      })
    )
    vi.mocked(manipulateElement).mockResolvedValue({ id: 93 } as never)

    await keepGeneratedElementDraft(
      {
        ...input,
        type: DB.ElementType.MC,
        options: {
          ...input.options,
          choices: mcCurrent.choices.map((choice, ix) => ({
            ix,
            value: choice.text,
            correct: choice.correct,
            feedback: choice.feedback,
          })),
        },
      },
      ctx as never
    )

    expect(manipulateElement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DB.ElementType.MC,
        options: expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({ ix: 2, value: 'Answer C' }),
          ]),
        }),
      }),
      expect.objectContaining({ prisma: transaction })
    )
  })

  it('returns the linked element for a network retry after the draft was saved', async () => {
    const existing = draft({
      revision: 3,
      decision: DB.GeneratedElementDecision.ACCEPTED,
      savedElementId: 91,
      savedAt,
    })
    const { ctx } = context(existing)

    await expect(
      keepGeneratedElementDraft(
        { ...input, name: 'Payload is ignored after persistence' },
        ctx as never
      )
    ).resolves.toMatchObject({ savedElementId: 91 })
    expect(manipulateElement).not.toHaveBeenCalled()
  })

  it('fences stale revisions before creating an element', async () => {
    const { ctx } = context(draft())

    await expect(
      keepGeneratedElementDraft({ ...input, expectedRevision: 1 }, ctx as never)
    ).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' })
    expect(manipulateElement).not.toHaveBeenCalled()
  })

  it('fails the transaction when the final draft link loses its revision fence', async () => {
    const { ctx, transaction } = context(draft())
    transaction.generatedElementDraft.updateMany.mockResolvedValueOnce({
      count: 0,
    })
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await expect(
      keepGeneratedElementDraft(input, ctx as never)
    ).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' })
    expect(manipulateElement).toHaveBeenCalledOnce()
    expect(
      transaction.generatedElementDraft.findUniqueOrThrow
    ).not.toHaveBeenCalled()
  })

  it('does not keep a discarded draft', async () => {
    const { ctx } = context(
      draft({ decision: DB.GeneratedElementDecision.REJECTED })
    )

    await expect(
      keepGeneratedElementDraft(input, ctx as never)
    ).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    expect(manipulateElement).not.toHaveBeenCalled()
  })

  it('rejects a generated element type change', async () => {
    const { ctx } = context(draft())

    await expect(
      keepGeneratedElementDraft(
        { ...input, type: DB.ElementType.MC },
        ctx as never
      )
    ).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    expect(manipulateElement).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'missing options', options: undefined },
    {
      label: 'missing choices',
      options: { ...input.options, choices: undefined },
    },
  ])('rejects assessment options with $label', async ({ options }) => {
    const { ctx } = context(draft())

    await expect(
      keepGeneratedElementDraft({ ...input, options } as never, ctx as never)
    ).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    expect(manipulateElement).not.toHaveBeenCalled()
  })

  it('does not expose a draft owned by another lecturer', async () => {
    const transaction = {
      generatedElementDraft: {
        findFirst: vi.fn(async () => null),
      },
    }
    const ctx = {
      user: { sub: ownerId },
      prisma: {
        $transaction: vi.fn(async (callback) => callback(transaction)),
      },
    }

    await expect(
      keepGeneratedElementDraft(input, ctx as never)
    ).rejects.toMatchObject({ code: 'GENERATED_QUESTION_DRAFT_NOT_FOUND' })
    expect(manipulateElement).not.toHaveBeenCalled()
  })
})
