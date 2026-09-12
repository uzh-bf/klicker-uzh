import { ElementStatus, ElementType } from '@klicker-uzh/prisma/client'
import {
  prepareElementMutation,
  type PreviousElementMutationState,
} from '../src/services/elementMutationPreparation.js'

describe('element mutation preparation', () => {
  it('prepares a selection edit once with its authorized pool', async () => {
    const resolvePool = vi.fn(async () => [10, 20] as const)
    const prepared = await prepareElementMutation(
      {
        type: ElementType.SELECTION,
        status: ElementStatus.READY,
        name: 'Selection',
        content: 'Select an answer',
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          hasSampleSolution: true,
          answerCollection: 7,
          numberOfInputs: 1,
          correctAnswers: [10],
        },
      },
      undefined,
      resolvePool
    )

    expect(resolvePool).toHaveBeenCalledExactlyOnceWith(7)
    expect(prepared).toMatchObject({
      shouldWriteOptions: true,
      answerCollectionId: 7,
      relationWrite: {
        answerCollectionId: 7,
        selectedIds: [10],
        connectSelectedItems: true,
        disconnectIds: [],
      },
      domain: {
        options: { hasSampleSolution: true, numberOfInputs: 1 },
      },
    })
  })

  it('preserves invalid legacy fields, options, and relations during unrelated partial edits', async () => {
    const legacyOptions = {
      deprecatedSetting: true,
    }
    const previous: PreviousElementMutationState = {
      type: ElementType.FLASHCARD,
      status: ElementStatus.READY,
      name: 'Legacy flashcard',
      content: '<br>',
      explanation: null,
      basePoints: false,
      pointsMultiplier: 9,
      options: legacyOptions,
      answerCollectionId: null,
      answerCollectionItems: [],
    }
    const resolvePool = vi.fn()

    const prepared = await prepareElementMutation(
      {
        id: 42,
        type: ElementType.FLASHCARD,
        name: 'Renamed legacy element',
      },
      previous,
      resolvePool
    )

    expect(resolvePool).not.toHaveBeenCalled()
    expect(prepared).toMatchObject({
      status: ElementStatus.READY,
      name: 'Renamed legacy element',
      shouldWriteOptions: false,
      relationWrite: undefined,
      domain: {
        content: '<br>',
        explanation: null,
        basePoints: false,
        pointsMultiplier: 9,
        options: legacyOptions,
      },
    })

    await expect(
      prepareElementMutation(
        {
          id: 42,
          type: ElementType.FLASHCARD,
          name: 'Explicitly edited legacy element',
          pointsMultiplier: 9,
        },
        previous,
        resolvePool
      )
    ).resolves.toBeNull()
  })

  it('rejects a relation when its answer collection is not accessible', async () => {
    await expect(
      prepareElementMutation(
        {
          type: ElementType.SELECTION,
          status: ElementStatus.READY,
          name: 'Selection',
          content: 'Select an answer',
          basePoints: true,
          pointsMultiplier: 1,
          options: {
            hasSampleSolution: false,
            answerCollection: 7,
            numberOfInputs: 1,
          },
        },
        undefined,
        async () => null
      )
    ).resolves.toBeNull()
  })
})
