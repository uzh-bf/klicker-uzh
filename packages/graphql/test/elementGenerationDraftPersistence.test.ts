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
  choiceIds: current.choices.map((choice) => choice.id),
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
    savedElement: null,
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
    ownerId,
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
    tags: [{ id: 12, name: 'generated' }],
  }
}

function context(fullDraft: ReturnType<typeof draft>) {
  // A retry runs the same reads against committed state again, so the ownership
  // probe and the detail read are modelled by query shape rather than a one-shot
  // queue that a second transaction would exhaust.
  const findFirst = vi.fn(async (args: Record<string, unknown>) =>
    'select' in args ? { buildId } : fullDraft
  )
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
    tag: {
      findMany: vi.fn(async () => [] as Array<{ id: number }>),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 900 })),
    },
    element: {
      update: vi.fn(async () => ({ id: 91 })),
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
        // The legacy name input is stored as the requested selection intent.
        current: {
          ...current,
          tagSelection: { existingTagIds: [], newTagNames: ['generated'] },
        },
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
      savedElement: savedElement(),
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
        pointsMultiplier: 10,
        tags: ['edited-flashcard'],
      },
      ctx as never
    )

    expect(manipulateElement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DB.ElementType.FLASHCARD,
        status: DB.ElementStatus.DRAFT,
        basePoints: false,
        pointsMultiplier: 1,
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

  it('returns an exactly persisted optionless Flashcard on retry', async () => {
    const flashcard = {
      name: 'Definition',
      front: 'What is atomicity?',
      back: 'A transaction either completes fully or has no effect.',
      cardType: 'definition' as const,
      tags: ['generated-flashcard', 'flashcard:definition'],
    }
    const flashcardInput = {
      draftId,
      expectedRevision: 2,
      status: DB.ElementStatus.REVIEW,
      type: DB.ElementType.FLASHCARD,
      name: flashcard.name,
      content: flashcard.front,
      explanation: flashcard.back,
      basePoints: false,
      pointsMultiplier: 1,
      tags: flashcard.tags,
    }
    const { ctx, transaction } = context(
      draft({
        elementType: DB.ElementType.FLASHCARD,
        original: flashcard,
        current: flashcard,
        targetDifficulty: null,
        revision: 3,
        decision: DB.GeneratedElementDecision.ACCEPTED,
        savedElementId: 92,
        savedElement: {
          id: 92,
          ownerId,
          type: DB.ElementType.FLASHCARD,
          status: DB.ElementStatus.REVIEW,
          name: flashcard.name,
          content: flashcard.front,
          explanation: flashcard.back,
          basePoints: false,
          pointsMultiplier: 1,
          difficultyLevel: null,
          options: {},
          tags: flashcard.tags.map((name) => ({ name })),
        },
        savedAt,
      })
    )

    await expect(
      keepGeneratedElementDraft(flashcardInput, ctx as never)
    ).resolves.toMatchObject({ savedElementId: 92 })
    expect(manipulateElement).not.toHaveBeenCalled()
    expect(transaction.generatedElementDraft.updateMany).not.toHaveBeenCalled()
  })

  it('preserves choice identities through reorder and replacement', async () => {
    const { ctx, transaction } = context(draft())
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)
    const editedChoices = [
      {
        id: 'choice-b',
        ix: 0,
        value: 'Answer B edited',
        correct: true,
        feedback: null,
      },
      {
        id: 'choice-new',
        ix: 1,
        value: 'Answer C',
        correct: false,
        feedback: null,
      },
    ]

    await keepGeneratedElementDraft(
      {
        ...input,
        choiceIds: editedChoices.map((choice) => choice.id),
        options: { ...input.options, choices: editedChoices },
      },
      ctx as never
    )

    expect(transaction.generatedElementDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          current: expect.objectContaining({
            choices: [
              expect.objectContaining({
                id: 'choice-b',
                label: 'A',
                text: 'Answer B edited',
              }),
              expect.objectContaining({
                id: 'choice-new',
                label: 'B',
                text: 'Answer C',
              }),
            ],
          }),
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
        choiceIds: mcCurrent.choices.map((choice) => choice.id),
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

  it('rejects a changed payload after the draft was saved', async () => {
    const existing = draft({
      revision: 3,
      decision: DB.GeneratedElementDecision.ACCEPTED,
      savedElementId: 91,
      savedElement: savedElement(),
      savedAt,
    })
    const { ctx } = context(existing)

    await expect(
      keepGeneratedElementDraft(
        { ...input, name: 'Payload is ignored after persistence' },
        ctx as never
      )
    ).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' })
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
    {
      label: 'empty choices',
      options: { ...input.options, choices: [] },
    },
  ])('rejects assessment options with $label', async ({ options }) => {
    const { ctx } = context(draft())

    await expect(
      keepGeneratedElementDraft({ ...input, options } as never, ctx as never)
    ).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    expect(manipulateElement).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'missing', choiceIds: undefined },
    { label: 'wrong count', choiceIds: ['choice-a'] },
    { label: 'duplicates', choiceIds: ['choice-a', 'choice-a'] },
  ])('rejects $label assessment choice identities', async ({ choiceIds }) => {
    const { ctx } = context(draft())

    await expect(
      keepGeneratedElementDraft({ ...input, choiceIds }, ctx as never)
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

  it('connects a selection by validated owner id instead of by name', async () => {
    const { ctx, transaction } = context(draft())
    transaction.tag.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }])
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await keepGeneratedElementDraft(
      {
        ...input,
        tags: undefined,
        tagSelection: { existingTagIds: [7, 8], newTagNames: [] },
      },
      ctx as never
    )

    expect(transaction.tag.create).not.toHaveBeenCalled()
    expect(manipulateElement).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] }),
      expect.objectContaining({ prisma: transaction })
    )
    expect(transaction.element.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: { tags: { set: [{ id: 7 }, { id: 8 }] } },
    })
  })

  it('creates a new proposal in the keep transaction and connects it by id', async () => {
    const { ctx, transaction } = context(draft())
    transaction.tag.create.mockResolvedValue({ id: 901 })
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await keepGeneratedElementDraft(
      {
        ...input,
        tags: undefined,
        tagSelection: { existingTagIds: [], newTagNames: ['Frisch'] },
      },
      ctx as never
    )

    expect(transaction.tag.create).toHaveBeenCalledWith({
      data: { name: 'Frisch', owner: { connect: { id: ownerId } } },
      select: { id: true },
    })
    expect(transaction.element.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: { tags: { set: [{ id: 901 }] } },
    })
  })

  it('preserves the stored selection when both tag fields are omitted', async () => {
    const storedSelection = { existingTagIds: [7], newTagNames: [] }
    const { ctx, transaction } = context(
      draft({ current: { ...current, tagSelection: storedSelection } })
    )
    transaction.tag.findMany.mockResolvedValue([{ id: 7 }])
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await keepGeneratedElementDraft({ ...input, tags: undefined }, ctx as never)

    expect(transaction.element.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: { tags: { set: [{ id: 7 }] } },
    })
    expect(transaction.generatedElementDraft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          current: expect.objectContaining({ tagSelection: storedSelection }),
        }),
      })
    )
  })

  it('clears the stored selection with an explicitly empty selection', async () => {
    const { ctx, transaction } = context(
      draft({
        current: {
          ...current,
          tagSelection: { existingTagIds: [7], newTagNames: [] },
        },
      })
    )
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await keepGeneratedElementDraft(
      {
        ...input,
        tags: undefined,
        tagSelection: { existingTagIds: [], newTagNames: [] },
      },
      ctx as never
    )

    expect(transaction.tag.findMany).not.toHaveBeenCalled()
    expect(transaction.tag.create).not.toHaveBeenCalled()
    expect(transaction.element.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: { tags: { set: [] } },
    })
  })

  it('rejects a request supplying both legacy tags and a selection', async () => {
    const { ctx } = context(draft())

    await expect(
      keepGeneratedElementDraft(
        { ...input, tagSelection: { existingTagIds: [], newTagNames: [] } },
        ctx as never
      )
    ).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    expect(manipulateElement).not.toHaveBeenCalled()
  })

  it('rejects a selection referencing a tag of another owner', async () => {
    const { ctx, transaction } = context(draft())
    transaction.tag.findMany.mockResolvedValue([])

    await expect(
      keepGeneratedElementDraft(
        {
          ...input,
          tags: undefined,
          tagSelection: { existingTagIds: [7], newTagNames: [] },
        },
        ctx as never
      )
    ).rejects.toMatchObject({ code: 'DRAFT_INVALID' })
    expect(manipulateElement).not.toHaveBeenCalled()
    expect(transaction.element.update).not.toHaveBeenCalled()
  })

  it('returns the linked element for an exact selection retry', async () => {
    const existing = draft({
      revision: 3,
      decision: DB.GeneratedElementDecision.ACCEPTED,
      savedElementId: 91,
      current: {
        ...current,
        tagSelection: { existingTagIds: [7], newTagNames: [] },
      },
      savedElement: {
        ...savedElement(),
        tags: [{ id: 7, name: 'Portfolio' }],
      },
      savedAt,
    })
    const { ctx, transaction } = context(existing)
    transaction.tag.findMany.mockResolvedValue([{ id: 7 }])

    await expect(
      keepGeneratedElementDraft({ ...input, tags: undefined }, ctx as never)
    ).resolves.toMatchObject({ savedElementId: 91 })
    expect(manipulateElement).not.toHaveBeenCalled()
    expect(transaction.tag.create).not.toHaveBeenCalled()
    expect(transaction.element.update).not.toHaveBeenCalled()
  })

  it('retries the keep transaction after a concurrent owner/name tag conflict', async () => {
    const { ctx, transaction } = context(draft())
    transaction.tag.create
      .mockRejectedValueOnce(
        // The real Prisma 7 driver-adapter report for a duplicate owner/name tag.
        new DB.Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: ("ownerId", name)',
          {
            code: 'P2002',
            clientVersion: '7.8.0',
            meta: {
              modelName: 'Tag',
              driverAdapterError: {
                cause: {
                  kind: 'UniqueConstraintViolation',
                  originalCode: '23505',
                  constraint: { fields: ['"ownerId"', 'name'] },
                  originalMessage:
                    'duplicate key value violates unique constraint "Tag_ownerId_name_key"',
                },
              },
            },
          }
        )
      )
      .mockResolvedValue({ id: 901 })
    vi.mocked(manipulateElement).mockResolvedValue(savedElement() as never)

    await expect(
      keepGeneratedElementDraft(
        {
          ...input,
          tags: undefined,
          tagSelection: { existingTagIds: [], newTagNames: ['Frisch'] },
        },
        ctx as never
      )
    ).resolves.toMatchObject({ savedElementId: 91 })

    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(transaction.element.update).toHaveBeenCalledTimes(1)
    expect(transaction.element.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: { tags: { set: [{ id: 901 }] } },
    })
  })
})
