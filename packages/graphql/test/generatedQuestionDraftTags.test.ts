import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'

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

import { updateGeneratedQuestionDraft } from '../src/services/questionGenerationDrafts.js'

const ownerId = '123e4567-e89b-42d3-a456-426614174000'
const buildId = '223e4567-e89b-42d3-a456-426614174000'
const draftId = '323e4567-e89b-42d3-a456-426614174000'

const choices = [
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
]

const currentInput = {
  name: 'Edited question',
  stem: 'Which answer is correct?',
  context: null,
  explanation: null,
  choices,
}

const expectedCurrent = {
  itemType: 'SC' as const,
  name: currentInput.name,
  stem: currentInput.stem,
  context: null,
  explanation: null,
  choices,
}

function storedDraft(tagSelection?: {
  existingTagIds: number[]
  newTagNames: string[]
}) {
  return {
    id: draftId,
    buildId,
    elementType: DB.ElementType.SC,
    savedElementId: null,
    revision: 4,
    current: {
      ...expectedCurrent,
      ...(tagSelection ? { tagSelection } : {}),
    },
    build: { status: DB.ElementGenerationBuildStatus.COMPLETED },
  }
}

function draftContext(fullDraft: ReturnType<typeof storedDraft>) {
  const updateMany = vi.fn(async () => ({ count: 1 }))
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    generatedElementDraft: {
      findFirst: vi.fn(async () => fullDraft),
      updateMany,
      findUniqueOrThrow: vi.fn(async () => ({ ...fullDraft, revision: 5 })),
    },
  }
  return {
    updateMany,
    ctx: {
      user: { sub: ownerId },
      prisma: {
        generatedElementDraft: { findFirst: vi.fn(async () => fullDraft) },
        $transaction: vi.fn(async (callback) => callback(transaction)),
      },
    },
  }
}

describe('generated question draft tag selection', () => {
  it('preserves the stored selection when a legacy client omits the selection', async () => {
    const tagSelection = { existingTagIds: [7], newTagNames: ['Frisch'] }
    const { ctx, updateMany } = draftContext(storedDraft(tagSelection))

    await updateGeneratedQuestionDraft(
      { draftId, expectedRevision: 4, current: currentInput },
      ctx as never
    )

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: draftId, revision: 4, savedElementId: null },
      data: {
        current: { ...expectedCurrent, tagSelection },
        revision: { increment: 1 },
      },
    })
  })

  it('clears the stored selection with an explicitly empty selection', async () => {
    const { ctx, updateMany } = draftContext(
      storedDraft({ existingTagIds: [7], newTagNames: [] })
    )

    await updateGeneratedQuestionDraft(
      {
        draftId,
        expectedRevision: 4,
        current: currentInput,
        tagSelection: { existingTagIds: [], newTagNames: [] },
      },
      ctx as never
    )

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: draftId, revision: 4, savedElementId: null },
      data: {
        current: {
          ...expectedCurrent,
          tagSelection: { existingTagIds: [], newTagNames: [] },
        },
        revision: { increment: 1 },
      },
    })
  })

  it('adds no selection field when the draft never held one', async () => {
    const { ctx, updateMany } = draftContext(storedDraft())

    await updateGeneratedQuestionDraft(
      { draftId, expectedRevision: 4, current: currentInput },
      ctx as never
    )

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: draftId, revision: 4, savedElementId: null },
      data: { current: expectedCurrent, revision: { increment: 1 } },
    })
  })
})
