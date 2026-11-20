import * as DB from '@klicker-uzh/prisma/client'
import type { ElementOptionsNumerical } from '@klicker-uzh/types'
import type { GraphQLObjectType } from 'graphql'
import { describe, expect, it } from 'vitest'
import { computeNumericalValues } from '../src/lib/numericalParametrization.js'
import { manipulateElement } from '../src/services/elements.js'
import {
  courseId,
  createdElementIds,
  createdQuizIds,
  getGroupActivityDetails,
  getPracticeQuizData,
  lecturerCtx,
  manipulatePracticeQuiz,
  participantCtx,
  prisma,
  recomputeDerivedPermissions,
  respondToElementStack,
  schema,
  seedEscapeRoomGroupActivity,
  seedEscapeRoomPracticeQuiz,
  seedParticipant,
  StackFeedbackStatus,
  startEscapeRoomAttempt,
  submitGroupActivityDecisions,
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

function solutionFor(attemptId: string, elementId: number) {
  const values = computeNumericalValues(
    parametrizedOptions.parametrization,
    `${attemptId}:${elementId}`
  )
  return { values, solution: values.target! - values.E! }
}

function numericalResponse(instanceId: number, value: number) {
  return {
    instanceId,
    type: DB.ElementType.NUMERICAL,
    numericalResponse: value,
  }
}

describe('escape room numbers: per-attempt play', () => {
  async function seedQuizWithPlayers() {
    const element = await createParametrizedElement()
    const quiz = await seedEscapeRoomPracticeQuiz(
      {
        elements: [element],
        courseId,
        status: DB.PublicationStatus.PUBLISHED,
        lockoutSeconds: 0,
      },
      lecturerCtx
    )
    createdQuizIds.push(quiz.id)
    const players = [
      await seedParticipant(`numbers-a-${quiz.id}`),
      await seedParticipant(`numbers-b-${quiz.id}`),
    ]
    for (const player of players) {
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(player.id)
      )
    }
    const attempts = await Promise.all(
      players.map((player) =>
        prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: {
            participantId_practiceQuizId: {
              participantId: player.id,
              practiceQuizId: quiz.id,
            },
          },
        })
      )
    )
    return { element, quiz, players, attempts }
  }

  it('shows each player their own numbers and grades against their own solution', async () => {
    const { element, quiz, players, attempts } = await seedQuizWithPlayers()
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!
    const [a, b] = attempts.map((attempt) =>
      solutionFor(attempt.id, element.id)
    )
    expect(a!.values).not.toEqual(b!.values)

    const view = await getPracticeQuizData(
      { id: quiz.id },
      participantCtx(players[0]!.id)
    )
    const viewData = view!.stacks[0]!.elements[0]!.elementData as {
      content: string
      explanation: string | null
    }
    expect(viewData.content).toContain(
      a!.values.A!.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    )
    // the stage is open, so its explanation is withheld
    expect(viewData.explanation).toBeNull()

    if (Math.abs(a!.solution - b!.solution) > 2) {
      const other = await respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [numericalResponse(instance.id, b!.solution)],
          stackAnswerTime: 5,
        },
        participantCtx(players[0]!.id)
      )
      expect(other!.status).toBe(StackFeedbackStatus.INCORRECT)
    }
    const own = await respondToElementStack(
      {
        stackId: stack.id,
        courseId,
        responses: [numericalResponse(instance.id, a!.solution)],
        stackAnswerTime: 5,
      },
      participantCtx(players[0]!.id)
    )
    expect(own!.status).toBe(StackFeedbackStatus.CORRECT)
    const evaluation = own!.evaluations![0] as {
      solutionRanges?: { min: number; max: number }[]
    }
    expect(evaluation.solutionRanges).toEqual([
      { min: a!.solution - 1, max: a!.solution + 1 },
    ])
  })

  it('returns mistake feedback, records the key and keeps it through later writes', async () => {
    const { element, quiz, players, attempts } = await seedQuizWithPlayers()
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!
    const { values } = solutionFor(attempts[0]!.id, element.id)

    const result = await respondToElementStack(
      {
        stackId: stack.id,
        courseId,
        responses: [numericalResponse(instance.id, values.target!)],
        stackAnswerTime: 5,
      },
      participantCtx(players[0]!.id)
    )
    expect(result!.status).toBe(StackFeedbackStatus.INCORRECT)
    expect(result!.mistakes).toEqual([
      {
        label: 'Whole requirement instead of the gap',
        feedback: 'Subtract the capital the bank already holds.',
      },
    ])
    expect(result!.evaluations).toBeUndefined()

    // a later wrong answer rewrites the outcome list and must keep the key
    const unmatched = await respondToElementStack(
      {
        stackId: stack.id,
        courseId,
        responses: [numericalResponse(instance.id, -1)],
        stackAnswerTime: 5,
      },
      participantCtx(players[0]!.id)
    )
    expect(unmatched!.mistakes).toBeUndefined()
    const stored = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempts[0]!.id },
    })
    expect(
      (
        stored.stageOutcomes as { stageKey: string; mistakes?: string[] }[]
      ).find((entry) => entry.stageKey === String(stack.id))?.mistakes
    ).toEqual([`${instance.id}:whole`])
  })

  it('keeps answers to parametrized stages out of the shared instance statistics', async () => {
    const { element, quiz, players, attempts } = await seedQuizWithPlayers()
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!
    const before = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: instance.id },
    })
    const { solution } = solutionFor(attempts[0]!.id, element.id)
    await respondToElementStack(
      {
        stackId: stack.id,
        courseId,
        responses: [numericalResponse(instance.id, solution)],
        stackAnswerTime: 5,
      },
      participantCtx(players[0]!.id)
    )
    const after = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: instance.id },
    })
    expect(after.results).toEqual(before.results)
    const responses = await prisma.questionResponse.findMany({
      where: { elementInstanceId: instance.id, participantId: players[0]!.id },
    })
    expect(responses).toHaveLength(1)
  })

  it('gives each group its own numbers and returns mistake feedback on a wrong answer', async () => {
    const element = await createParametrizedElement()
    const memberA = await seedParticipant(`numbers-ga-${element.id}`)
    const memberB = await seedParticipant(`numbers-gb-${element.id}`)
    const first = await seedEscapeRoomGroupActivity(
      { elements: [element], courseId, participantIds: [memberA.id] },
      lecturerCtx
    )
    const second = await seedEscapeRoomGroupActivity(
      { elements: [element], courseId, participantIds: [memberB.id] },
      lecturerCtx
    )
    const a = solutionFor(first.attempt.id, element.id)
    const b = solutionFor(second.attempt.id, element.id)
    expect(a.values).not.toEqual(b.values)

    const details = await getGroupActivityDetails(
      { activityId: first.groupActivity.id, groupId: first.group.id },
      participantCtx(memberA.id)
    )
    const stage = details!.stacks[0]!.elements[0]!
    expect(
      (stage.elementData as { explanation: string | null }).explanation
    ).toBeNull()

    const instanceId = first.groupActivity.stacks[0]!.elements[0]!.id
    const resultsBefore = (
      await prisma.elementInstance.findUniqueOrThrow({
        where: { id: instanceId },
      })
    ).results
    const error = await submitGroupActivityDecisions(
      {
        activityId: first.activityInstance.id,
        responses: [numericalResponse(instanceId, a.values.target!)],
      },
      participantCtx(memberA.id)
    ).catch((caught) => caught)
    expect(error.extensions.code).toBe('ESCAPE_ROOM_LOCKOUT')
    expect(error.extensions.mistake).toEqual({
      label: 'Whole requirement instead of the gap',
      feedback: 'Subtract the capital the bank already holds.',
    })
    const attempt = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: first.attempt.id },
    })
    expect(
      (attempt.stageOutcomes as { mistakes?: string[] }[])[0]?.mistakes
    ).toEqual([`${instanceId}:whole`])
    expect(
      (
        await prisma.elementInstance.findUniqueOrThrow({
          where: { id: instanceId },
        })
      ).results
    ).toEqual(resultsBefore)
  })
})
