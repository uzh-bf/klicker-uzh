import {
  ElementStackType,
  ElementType,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  prisma,
  role = UserRole.PARTICIPANT,
  sub = 'participant-1',
}: {
  prisma?: TRPCContext['prisma']
  role?: UserRole
  sub?: string
} = {}): TRPCContext {
  return {
    prisma,
    user: {
      sub,
      role,
    },
  }
}

describe('participant stack evaluation routers', () => {
  test('returns a previous stack evaluation reconstructed from stored responses', async () => {
    const elementStackFindUnique = vi.fn().mockResolvedValue({
      id: 42,
      elements: [
        {
          id: 101,
          elementData: {
            id: 'choice-v1',
            elementId: 11,
            name: 'Choice question',
            type: ElementType.SC,
            content: 'Pick one',
            explanation: 'Choice explanation',
            basePoints: true,
            pointsMultiplier: 1,
            options: {
              hasSampleSolution: true,
              displayMode: 'LIST',
              choices: [
                {
                  ix: 0,
                  value: 'Correct',
                  correct: true,
                  feedback: 'Well done',
                },
                {
                  ix: 1,
                  value: 'Wrong',
                  correct: false,
                  feedback: 'Try again',
                },
              ],
            },
          },
          options: {
            pointsMultiplier: 1,
          },
          results: {
            choices: {
              0: 1,
            },
            total: 1,
          },
          anonymousResults: {
            choices: {
              1: 2,
            },
            total: 2,
          },
          responses: [
            {
              lastResponse: {
                choices: [{ ix: 0, selected: true }],
              },
            },
          ],
        },
      ],
    })
    const prisma = {
      elementStack: {
        findUnique: elementStackFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.previousStackEvaluation({ stackId: 42 })
    ).resolves.toEqual({
      id: 42,
      status: StackFeedbackStatus.CORRECT,
      score: 10,
      evaluations: [
        {
          __typename: 'ChoicesInstanceEvaluation',
          instanceId: 101,
          elementType: ElementType.SC,
          pointsMultiplier: 1,
          explanation: 'Choice explanation',
          feedbacks: [
            {
              ix: 0,
              value: 'Correct',
              correct: true,
              feedback: 'Well done',
            },
            {
              ix: 1,
              value: 'Wrong',
              correct: false,
              feedback: 'Try again',
            },
          ],
          numAnswers: 3,
          score: 10,
          xp: 10,
          pointsAwarded: 10,
          percentile: 1,
          newPointsFrom: null,
          xpAwarded: 10,
          newXpFrom: null,
          correctness: 1,
          choices: [
            {
              ix: 0,
              count: 1,
            },
            {
              ix: 1,
              count: 2,
            },
          ],
          lastResponse: {
            __typename: 'SingleQuestionResponseChoices',
            choices: [
              {
                __typename: 'ChoicesResponseObject',
                ix: 0,
                selected: true,
              },
            ],
          },
        },
      ],
    })

    expect(elementStackFindUnique).toHaveBeenCalledWith({
      where: { id: 42, type: ElementStackType.MICROLEARNING },
      select: {
        id: true,
        elements: {
          select: {
            id: true,
            elementData: true,
            results: true,
            anonymousResults: true,
            options: true,
            responses: {
              where: { participantId: 'participant-1' },
              select: {
                lastResponse: true,
              },
            },
          },
        },
      },
    })
  })

  test('returns null when the stack is missing', async () => {
    const prisma = {
      elementStack: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.previousStackEvaluation({ stackId: 42 })
    ).resolves.toBeNull()
  })

  test('rejects previous stack evaluation reads for lecturers', async () => {
    const caller = appRouter.createCaller(
      createContext({
        role: UserRole.USER,
        sub: 'lecturer-1',
      })
    )

    await expect(
      caller.participant.previousStackEvaluation({ stackId: 42 })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
