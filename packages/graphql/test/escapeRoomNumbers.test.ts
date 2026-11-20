import * as DB from '@klicker-uzh/prisma/client'
import type { ElementOptionsNumerical } from '@klicker-uzh/types'
import type { GraphQLObjectType } from 'graphql'
import { describe, expect, it } from 'vitest'
import { manipulateElement } from '../src/services/elements.js'
import {
  courseId,
  createdElementIds,
  createdQuizIds,
  lecturerCtx,
  manipulatePracticeQuiz,
  prisma,
  recomputeDerivedPermissions,
  schema,
  TEST_PREFIX,
} from './escapeRoomTestHarness.js'

// Synthetic parametrized element: the gap between a capital target and the
// capital a bank holds. Values differ per draw; the solution is a formula.
const parametrizedOptions = {
  hasSampleSolution: true,
  accuracy: 0,
  unit: 'CHF M',
  parametrization: {
    variables: [
      { name: 'A', kind: 'INTEGER' as const, min: 80, max: 120, step: 1000 },
      { name: 'q', kind: 'PICK' as const, values: [8, 10, 12] },
      { name: 'E', kind: 'RANGE' as const, min: 2000, max: 3000, step: 10 },
    ],
    derived: [{ name: 'target', formula: 'A * q / 100', decimals: 0 }],
    solution: { formula: 'target - E', tolerance: 1 },
  },
  mistakes: [
    {
      key: 'whole',
      label: 'Whole requirement instead of the gap',
      feedback: 'Subtract the capital the bank already holds.',
      formula: 'target',
      tolerance: 1,
    },
  ],
}

function numericalInput(options: Record<string, unknown>) {
  return {
    status: DB.ElementStatus.READY,
    type: DB.ElementType.NUMERICAL,
    name: `${TEST_PREFIX}-numbers`,
    content: 'Assets {{A}}, quota {{q}} %, capital {{E}}. What is missing?',
    explanation: 'The target is {{target}}.',
    basePoints: true,
    pointsMultiplier: 1,
    tags: [],
    options,
  }
}

async function createParametrizedElement() {
  const element = await manipulateElement(
    numericalInput(parametrizedOptions) as any,
    lecturerCtx
  )
  createdElementIds.push(element!.id)
  return element!
}

describe('escape room numbers: authoring and instances', () => {
  it('refuses formulas outside the allowlist and unknown placeholders on save', async () => {
    await expect(
      manipulateElement(
        numericalInput({
          ...parametrizedOptions,
          parametrization: {
            ...parametrizedOptions.parametrization,
            solution: { formula: 'A.constructor', tolerance: 1 },
          },
        }) as any,
        lecturerCtx
      )
    ).rejects.toThrow(/Invalid variables or typical mistakes/)

    await expect(
      manipulateElement(
        {
          ...numericalInput(parametrizedOptions),
          content: 'Value {{missing}}',
        } as any,
        lecturerCtx
      )
    ).rejects.toThrow(/Unknown placeholder/)
  })

  it('keeps the templates when an edit does not send them', async () => {
    const element = await createParametrizedElement()
    const { parametrization, mistakes, ...rest } = parametrizedOptions
    await manipulateElement(
      {
        ...numericalInput(rest),
        id: element.id,
        name: `${TEST_PREFIX}-renamed`,
      } as any,
      lecturerCtx
    )
    const stored = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
    })
    const options = stored.options as ElementOptionsNumerical
    expect(stored.name).toBe(`${TEST_PREFIX}-renamed`)
    expect(options.parametrization).toEqual(parametrization)
    expect(options.mistakes).toEqual(mistakes)
  })

  it('gives new instances concrete numbers and keeps templates off the participant options type', async () => {
    const element = await createParametrizedElement()
    await recomputeDerivedPermissions(
      { elementId: element.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const quiz = await manipulatePracticeQuiz(
      {
        name: `${TEST_PREFIX}-numbers-pq`,
        displayName: `${TEST_PREFIX}-numbers-pq`,
        stacks: [
          {
            order: 0,
            elements: [
              {
                elementId: element.id,
                order: 0,
                existingInstanceId: null,
                duplicateInstance: false,
              },
            ],
          },
        ],
        courseId,
        multiplier: 1,
        order: DB.ElementOrderType.SEQUENTIAL,
        resetTimeDays: 1,
        isEscapeRoom: true,
      } as any,
      lecturerCtx
    )
    createdQuizIds.push(quiz.id)

    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementStack: { practiceQuizId: quiz.id } },
    })
    const data = instance.elementData as {
      content: string
      explanation: string
      options: ElementOptionsNumerical
    }
    expect(data.content).not.toContain('{{')
    expect(data.explanation).not.toContain('{{')
    expect(data.options.solutionRanges).toHaveLength(1)
    expect(data.options.exactSolutions ?? undefined).toBeUndefined()
    expect(data.options.mistakeRanges?.[0]?.key).toBe('whole')
    expect(data.options.parametrization).toEqual(
      parametrizedOptions.parametrization
    )

    const participantOptions = schema.getType(
      'NumericalElementOptions'
    ) as GraphQLObjectType
    expect(Object.keys(participantOptions.getFields())).not.toEqual(
      expect.arrayContaining(['parametrization'])
    )
    for (const field of ['parametrization', 'mistakes', 'mistakeRanges']) {
      expect(participantOptions.getFields()[field]).toBeUndefined()
    }
  })
})
