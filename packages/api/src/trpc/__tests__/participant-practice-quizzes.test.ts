import {
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
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

function elementDataWithOptions(elementData: unknown) {
  return elementData as {
    __typename: string
    options: Record<string, unknown>
  }
}

describe('participant practice quiz routers', () => {
  test('returns participant practice quiz detail with ordered stacks and no solution fields', async () => {
    const practiceQuizFindUnique = vi.fn().mockResolvedValue({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      name: 'practice-quiz',
      displayName: 'Practice Quiz',
      description: 'Quiz description',
      pointsMultiplier: 2,
      resetTimeDays: 6,
      availableFrom: null,
      orderType: ElementOrderType.SPACED_REPETITION,
      ownerId: 'owner-1',
      course: {
        id: 'course-1',
        displayName: 'Course 1',
        color: '#0028a5',
      },
      stacks: [
        {
          id: 1,
          type: ElementStackType.PRACTICE_QUIZ,
          displayName: 'Due later',
          description: null,
          order: 1,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.SC,
              responses: [
                {
                  correctCount: 2,
                  correctCountStreak: 2,
                  lastCorrectAt: new Date('2026-01-01T00:00:00Z'),
                  nextDueAt: new Date('2026-01-03T00:00:00Z'),
                },
              ],
              elementData: {
                id: 'choice-v1',
                elementId: 101,
                name: 'Choice',
                type: ElementType.SC,
                content: 'Choice content',
                explanation: 'Choice explanation',
                basePoints: true,
                pointsMultiplier: 1,
                options: {
                  hasSampleSolution: true,
                  displayMode: 'LIST',
                  choices: [
                    {
                      ix: 0,
                      value: 'A',
                      correct: true,
                      feedback: 'Correct feedback',
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          id: 2,
          type: ElementStackType.PRACTICE_QUIZ,
          displayName: 'Unanswered',
          description: null,
          order: 2,
          elements: [
            {
              id: 21,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.NUMERICAL,
              responses: [],
              elementData: {
                id: 'numerical-v1',
                elementId: 102,
                name: 'Numerical',
                type: ElementType.NUMERICAL,
                content: 'Numerical content',
                explanation: null,
                basePoints: true,
                pointsMultiplier: 1,
                options: {
                  hasSampleSolution: true,
                  accuracy: 2,
                  placeholder: '42',
                  unit: 'kg',
                  restrictions: {
                    min: 0,
                    max: 100,
                  },
                  exactSolutions: [42],
                  solutionRanges: [{ min: 40, max: 44 }],
                },
              },
            },
          ],
        },
        {
          id: 3,
          type: ElementStackType.PRACTICE_QUIZ,
          displayName: 'Due sooner',
          description: null,
          order: 3,
          elements: [
            {
              id: 31,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.CASE_STUDY,
              responses: [
                {
                  correctCount: 1,
                  correctCountStreak: 1,
                  lastCorrectAt: new Date('2026-01-01T00:00:00Z'),
                  nextDueAt: new Date('2026-01-02T00:00:00Z'),
                },
              ],
              elementData: {
                id: 'case-v1',
                elementId: 103,
                name: 'Case',
                type: ElementType.CASE_STUDY,
                content: 'Case content',
                explanation: null,
                basePoints: false,
                pointsMultiplier: 1,
                options: {
                  hasSampleSolution: true,
                  items: [{ id: 1, value: 'Item 1' }],
                  criteria: [
                    {
                      id: 'criterion-1',
                      name: 'Criterion',
                      min: 0,
                      max: 5,
                      step: 1,
                      unit: null,
                      labels: { min: 'Low', mid: 'Mid', max: 'High' },
                      order: 1,
                    },
                  ],
                  cases: [
                    {
                      id: 'case-1',
                      title: 'Case 1',
                      description: 'Case description',
                      solutions: [
                        {
                          itemId: 1,
                          criteriaSolutions: [
                            { criterionId: 'criterion-1', min: 3, max: 5 },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    })
    const prisma = {
      practiceQuiz: {
        findUnique: practiceQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    const result = await caller.participant.practiceQuiz({ id: 'quiz-1' })

    expect(result.practiceQuiz?.isOwner).toBe(false)
    expect(result.practiceQuiz?.numOfStacks).toBe(3)
    expect(result.practiceQuiz?.stacks.map((stack) => stack.id)).toEqual([
      2, 3, 1,
    ])
    expect(result.practiceQuiz?.course).toEqual({
      __typename: 'Course',
      id: 'course-1',
      displayName: 'Course 1',
      color: '#0028a5',
    })

    const numerical = elementDataWithOptions(
      result.practiceQuiz?.stacks[0]?.elements[0]?.elementData
    )
    expect(numerical.__typename).toBe('NumericalElementData')
    expect(numerical.options).toMatchObject({
      hasSampleSolution: true,
      accuracy: 2,
      placeholder: '42',
      unit: 'kg',
      restrictions: { min: 0, max: 100 },
    })
    expect(numerical.options.exactSolutions).toBeUndefined()
    expect(numerical.options.solutionRanges).toBeUndefined()

    const caseStudy = elementDataWithOptions(
      result.practiceQuiz?.stacks[1]?.elements[0]?.elementData
    )
    expect(caseStudy.__typename).toBe('CaseStudyElementData')
    expect(caseStudy.options.cases).toEqual([
      { id: 'case-1', title: 'Case 1', description: 'Case description' },
    ])

    const choices = elementDataWithOptions(
      result.practiceQuiz?.stacks[2]?.elements[0]?.elementData
    )
    expect(choices.__typename).toBe('ChoicesElementData')
    expect(choices.options.choices).toEqual([{ ix: 0, value: 'A' }])

    expect(practiceQuizFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'quiz-1',
        OR: [
          { status: PublicationStatus.PUBLISHED, isDeleted: false },
          { status: PublicationStatus.SCHEDULED },
          { permissions: { some: { userId: 'participant-1' } } },
        ],
      },
      select: expect.objectContaining({
        stacks: expect.objectContaining({
          select: expect.objectContaining({
            elements: expect.objectContaining({
              select: expect.objectContaining({
                responses: {
                  where: { participantId: 'participant-1' },
                  select: {
                    correctCount: true,
                    correctCountStreak: true,
                    lastCorrectAt: true,
                    nextDueAt: true,
                  },
                },
              }),
            }),
          }),
        }),
      }),
    })
  })

  test('hides scheduled quiz stacks from non-owners', async () => {
    const prisma = {
      practiceQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          status: PublicationStatus.SCHEDULED,
          name: 'scheduled-quiz',
          displayName: 'Scheduled Quiz',
          description: null,
          pointsMultiplier: 1,
          resetTimeDays: 6,
          availableFrom: new Date('2026-07-01T00:00:00Z'),
          orderType: ElementOrderType.SPACED_REPETITION,
          ownerId: 'owner-1',
          course: {
            id: 'course-1',
            displayName: 'Course 1',
            color: '#0028a5',
          },
          stacks: [
            {
              id: 1,
              type: ElementStackType.PRACTICE_QUIZ,
              displayName: 'Hidden',
              description: null,
              order: 1,
              elements: [],
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.participant.practiceQuiz({ id: 'quiz-1' })
    ).resolves.toMatchObject({
      practiceQuiz: {
        id: 'quiz-1',
        isOwner: false,
        numOfStacks: null,
        stacks: [],
      },
    })
  })

  test('keeps scheduled quiz stacks visible for owners', async () => {
    const prisma = {
      practiceQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          status: PublicationStatus.SCHEDULED,
          name: 'scheduled-quiz',
          displayName: 'Scheduled Quiz',
          description: null,
          pointsMultiplier: 1,
          resetTimeDays: 6,
          availableFrom: new Date('2026-07-01T00:00:00Z'),
          orderType: ElementOrderType.SPACED_REPETITION,
          ownerId: 'user-1',
          course: {
            id: 'course-1',
            displayName: 'Course 1',
            color: '#0028a5',
          },
          stacks: [
            {
              id: 1,
              type: ElementStackType.PRACTICE_QUIZ,
              displayName: 'Visible',
              description: null,
              order: 1,
              elements: [
                {
                  id: 11,
                  type: ElementInstanceType.PRACTICE_QUIZ,
                  elementType: ElementType.CONTENT,
                  elementData: {
                    id: 'content-v1',
                    elementId: 101,
                    name: 'Content',
                    type: ElementType.CONTENT,
                    content: 'Content',
                    explanation: null,
                    basePoints: false,
                    pointsMultiplier: 1,
                    options: {},
                  },
                },
              ],
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({ prisma, role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.practiceQuiz({ id: 'quiz-1' })
    ).resolves.toMatchObject({
      practiceQuiz: {
        id: 'quiz-1',
        isOwner: true,
        numOfStacks: null,
        stacks: [
          {
            id: 1,
            elements: [
              {
                id: 11,
                elementData: {
                  __typename: 'ContentElementData',
                },
              },
            ],
          },
        ],
      },
    })
  })

  test('returns null when the quiz is not visible', async () => {
    const prisma = {
      practiceQuiz: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.practiceQuiz({ id: 'missing-quiz' })
    ).resolves.toEqual({ practiceQuiz: null })
  })
})
