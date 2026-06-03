import {
  ElementInstanceType,
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

describe('participant microlearning routers', () => {
  test('returns microlearning detail with ordered stacks and no solution fields', async () => {
    const microLearningFindUnique = vi.fn().mockResolvedValue({
      id: 'microlearning-1',
      status: PublicationStatus.PUBLISHED,
      name: 'microlearning',
      displayName: 'Microlearning',
      description: 'Microlearning description',
      pointsMultiplier: 2,
      scheduledStartAt: new Date('2026-01-01T08:00:00Z'),
      scheduledEndAt: new Date('2026-01-07T08:00:00Z'),
      ownerId: 'owner-1',
      course: {
        id: 'course-1',
        displayName: 'Course 1',
        color: '#0028a5',
      },
      stacks: [
        {
          id: 1,
          type: ElementStackType.MICROLEARNING,
          displayName: 'First stack',
          description: null,
          order: 1,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.MICROLEARNING,
              elementType: ElementType.SC,
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
          type: ElementStackType.MICROLEARNING,
          displayName: 'Second stack',
          description: 'Second stack description',
          order: 2,
          elements: [
            {
              id: 21,
              type: ElementInstanceType.MICROLEARNING,
              elementType: ElementType.NUMERICAL,
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
      ],
    })
    const prisma = {
      microLearning: {
        findUnique: microLearningFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    const result = await caller.participant.microLearning({
      id: 'microlearning-1',
    })

    expect(result.microLearning?.isOwner).toBe(false)
    expect(result.microLearning?.scheduledStartAt).toBe(
      '2026-01-01T08:00:00.000Z'
    )
    expect(result.microLearning?.scheduledEndAt).toBe(
      '2026-01-07T08:00:00.000Z'
    )
    expect(result.microLearning?.course).toEqual({
      __typename: 'Course',
      id: 'course-1',
      displayName: 'Course 1',
      color: '#0028a5',
    })
    expect(result.microLearning?.stacks.map((stack) => stack.id)).toEqual([
      1, 2,
    ])

    const choices = elementDataWithOptions(
      result.microLearning?.stacks[0]?.elements[0]?.elementData
    )
    expect(choices.__typename).toBe('ChoicesElementData')
    expect(choices.options.choices).toEqual([{ ix: 0, value: 'A' }])

    const numerical = elementDataWithOptions(
      result.microLearning?.stacks[1]?.elements[0]?.elementData
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

    expect(microLearningFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'microlearning-1',
        OR: [
          { status: PublicationStatus.PUBLISHED, isDeleted: false },
          { permissions: { some: { userId: 'participant-1' } } },
        ],
      },
      select: expect.objectContaining({
        stacks: expect.objectContaining({
          orderBy: { order: 'asc' },
          select: expect.objectContaining({
            elements: expect.objectContaining({
              orderBy: { order: 'asc' },
              select: expect.objectContaining({
                elementData: true,
              }),
            }),
          }),
        }),
      }),
    })
  })

  test('returns owner flag for user-owned microlearnings', async () => {
    const prisma = {
      microLearning: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'microlearning-1',
          status: PublicationStatus.PUBLISHED,
          name: 'microlearning',
          displayName: 'Microlearning',
          description: null,
          pointsMultiplier: 1,
          scheduledStartAt: new Date('2026-01-01T08:00:00Z'),
          scheduledEndAt: new Date('2026-01-07T08:00:00Z'),
          ownerId: 'user-1',
          course: {
            id: 'course-1',
            displayName: 'Course 1',
            color: '#0028a5',
          },
          stacks: [],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({ prisma, role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.microLearning({ id: 'microlearning-1' })
    ).resolves.toMatchObject({
      microLearning: {
        id: 'microlearning-1',
        isOwner: true,
      },
    })
  })

  test('returns nullable course participation for the current participant', async () => {
    const participationFindUnique = vi.fn().mockResolvedValue({
      id: 3,
      isActive: true,
    })
    const prisma = {
      participation: {
        findUnique: participationFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.participation({ courseId: 'course-1' })
    ).resolves.toEqual({
      participation: {
        id: 3,
        isActive: true,
      },
    })

    expect(participationFindUnique).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      select: {
        id: true,
        isActive: true,
      },
    })
  })

  test('returns null course participation for anonymous users and lecturers', async () => {
    const participationFindUnique = vi.fn()
    const prisma = {
      participation: {
        findUnique: participationFindUnique,
      },
    } as unknown as TRPCContext['prisma']

    await expect(
      appRouter
        .createCaller({ prisma })
        .participant.participation({ courseId: 'course-1' })
    ).resolves.toEqual({ participation: null })
    await expect(
      appRouter
        .createCaller(createContext({ prisma, role: UserRole.USER }))
        .participant.participation({ courseId: 'course-1' })
    ).resolves.toEqual({ participation: null })

    expect(participationFindUnique).not.toHaveBeenCalled()
  })

  test('marks microlearning as completed on the course participation', async () => {
    const participationUpdate = vi.fn().mockResolvedValue({
      id: 3,
      completedMicroLearnings: ['microlearning-1'],
    })
    const prisma = {
      participation: {
        update: participationUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.markMicroLearningCompleted({
        courseId: 'course-1',
        id: 'microlearning-1',
      })
    ).resolves.toEqual({
      participation: {
        id: 3,
        completedMicroLearnings: ['microlearning-1'],
      },
    })

    expect(participationUpdate).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      data: {
        completedMicroLearnings: {
          push: 'microlearning-1',
        },
      },
      select: {
        id: true,
        completedMicroLearnings: true,
      },
    })
  })

  test('returns null when the microlearning is not visible', async () => {
    const prisma = {
      microLearning: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.microLearning({ id: 'missing-microlearning' })
    ).resolves.toEqual({ microLearning: null })
  })
})
