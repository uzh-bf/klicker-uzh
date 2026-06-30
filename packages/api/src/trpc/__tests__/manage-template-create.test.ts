import {
  ElementStatus,
  ElementType,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()

  return {
    ...actual,
    recomputeDerivedPermissions: vi.fn(),
  }
})

const user = {
  id: 'user-1',
}
const courseId = '00000000-0000-4000-8000-000000000001'

function createContext(prisma: TRPCContext['prisma']): TRPCContext {
  return {
    prisma,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

function accessibleTemplate() {
  return {
    liveQuiz: {
      ownerId: user.id,
      permissions: [],
      catalogAssignments: [],
    },
    practiceQuiz: null,
    microLearning: null,
    groupActivity: null,
  }
}

function templateLiveQuiz() {
  return {
    id: 'template-live-quiz-1',
    status: PublicationStatus.TEMPLATE,
    name: 'Template Live Quiz',
    pointsMultiplier: 2,
    defaultPoints: 10,
    defaultCorrectPoints: 5,
    maxBonusPoints: 3,
    timeToZeroBonus: 20,
    isConfusionFeedbackEnabled: true,
    isLiveQAEnabled: false,
    isModerationEnabled: true,
  }
}

function templateCreationInput(overrides: Record<string, unknown> = {}) {
  return {
    templateId: 'template-1',
    name: ' New Live Quiz ',
    displayName: 'New Live Quiz Display',
    description: 'Created from template',
    courseId,
    isGamificationEnabled: false,
    blocks: [
      {
        order: 0,
        timeLimit: 30,
        elements: [
          {
            order: 0,
            useExistingElement: true,
            existingElementId: 17,
            useNewElement: false,
            newElement: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('manage live quiz template creation router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
  })

  test('creates a live quiz from an accessible template with existing elements', async () => {
    const activityTemplateFindUnique = vi
      .fn()
      .mockResolvedValueOnce(accessibleTemplate())
      .mockResolvedValueOnce({
        liveQuizId: 'template-live-quiz-1',
        answerCollections: [],
      })
    const liveQuizFindUnique = vi.fn().mockResolvedValue(templateLiveQuiz())
    const courseFindUnique = vi.fn().mockResolvedValue({
      id: courseId,
      isGamificationEnabled: true,
      isAssessmentEnabled: true,
    })
    const existingElement = {
      id: 17,
      version: 1,
      type: ElementType.CONTENT,
      name: 'Content element',
      content: 'Content body',
      explanation: null,
      basePoints: false,
      pointsMultiplier: 1,
      options: {},
      answerCollection: null,
      answerCollectionItems: [],
    }
    const elementFindUnique = vi.fn().mockResolvedValue(existingElement)
    const liveQuizCreate = vi.fn().mockResolvedValue({ id: 'new-live-quiz-1' })
    const tx = {
      element: {
        findUnique: elementFindUnique,
      },
      liveQuiz: {
        create: liveQuizCreate,
      },
    }
    const transaction = vi
      .fn()
      .mockImplementation(async (callback) => callback(tx))
    const prisma = {
      activityTemplate: {
        findUnique: activityTemplateFindUnique,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      course: {
        findUnique: courseFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createLiveQuizFromTemplate(templateCreationInput())
    ).resolves.toEqual({ createLiveQuizFromTemplate: 'new-live-quiz-1' })

    expect(activityTemplateFindUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'template-1' } })
    )
    expect(activityTemplateFindUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 'template-1' },
      select: {
        liveQuizId: true,
        answerCollections: { select: { id: true } },
      },
    })
    expect(liveQuizFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'template-live-quiz-1',
        status: PublicationStatus.TEMPLATE,
      },
    })
    expect(courseFindUnique).toHaveBeenCalledWith({
      where: {
        id: courseId,
        permissions: { some: { userId: user.id } },
      },
    })
    expect(elementFindUnique).toHaveBeenCalledWith({
      where: {
        id: 17,
        permissions: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        answerCollection: {
          include: {
            entries: true,
          },
        },
        answerCollectionItems: true,
      },
    })
    expect(liveQuizCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'New Live Quiz',
        displayName: 'New Live Quiz Display',
        description: 'Created from template',
        templateName: 'Template Live Quiz',
        pointsMultiplier: 2,
        defaultPoints: 10,
        defaultCorrectPoints: 5,
        maxBonusPoints: 3,
        timeToZeroBonus: 20,
        isGamificationEnabled: true,
        isAssessmentEnabled: true,
        isConfusionFeedbackEnabled: true,
        isLiveQAEnabled: false,
        isModerationEnabled: true,
        owner: { connect: { id: user.id } },
        course: { connect: { id: courseId } },
        blocks: {
          create: [
            {
              order: 0,
              timeLimit: 30,
              elements: {
                create: [
                  expect.objectContaining({
                    elementType: ElementType.CONTENT,
                    order: 0,
                    owner: { connect: { id: user.id } },
                    element: { connect: { id: 17 } },
                  }),
                ],
              },
            },
          ],
        },
      }),
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { liveQuizId: 'new-live-quiz-1', userId: user.id },
      tx
    )
  })

  test('returns null when the template is not accessible', async () => {
    const activityTemplateFindUnique = vi.fn().mockResolvedValue(null)
    const transaction = vi.fn()
    const prisma = {
      activityTemplate: {
        findUnique: activityTemplateFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createLiveQuizFromTemplate(templateCreationInput())
    ).resolves.toEqual({ createLiveQuizFromTemplate: null })

    expect(transaction).not.toHaveBeenCalled()
  })

  test('returns null when the requested course is invalid for the user', async () => {
    const activityTemplateFindUnique = vi
      .fn()
      .mockResolvedValueOnce(accessibleTemplate())
      .mockResolvedValueOnce({
        liveQuizId: 'template-live-quiz-1',
        answerCollections: [],
      })
    const liveQuizFindUnique = vi.fn().mockResolvedValue(templateLiveQuiz())
    const courseFindUnique = vi.fn().mockResolvedValue(null)
    const transaction = vi.fn()
    const prisma = {
      activityTemplate: {
        findUnique: activityTemplateFindUnique,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      course: {
        findUnique: courseFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createLiveQuizFromTemplate(templateCreationInput())
    ).resolves.toEqual({ createLiveQuizFromTemplate: null })

    expect(transaction).not.toHaveBeenCalled()
  })

  test('propagates transaction failures like the GraphQL mutation', async () => {
    const activityTemplateFindUnique = vi
      .fn()
      .mockResolvedValueOnce(accessibleTemplate())
      .mockResolvedValueOnce({
        liveQuizId: 'template-live-quiz-1',
        answerCollections: [],
      })
    const liveQuizFindUnique = vi.fn().mockResolvedValue(templateLiveQuiz())
    const transaction = vi.fn().mockRejectedValue(new Error('create failed'))
    const prisma = {
      activityTemplate: {
        findUnique: activityTemplateFindUnique,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      course: {
        findUnique: vi.fn(),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createLiveQuizFromTemplate(
        templateCreationInput({ courseId: null })
      )
    ).rejects.toThrow('create failed')
  })

  test('creates new selection elements with owned inline answer collections', async () => {
    const activityTemplateFindUnique = vi
      .fn()
      .mockResolvedValueOnce(accessibleTemplate())
      .mockResolvedValueOnce({
        liveQuizId: 'template-live-quiz-1',
        answerCollections: [],
      })
    const liveQuizFindUnique = vi.fn().mockResolvedValue(templateLiveQuiz())
    const courseFindUnique = vi.fn()
    const derivedPermissionFindFirst = vi
      .fn()
      .mockResolvedValue({ answerCollectionId: 101, userId: user.id })
    const activityLogEntryCreate = vi.fn().mockResolvedValue({})
    const now = new Date('2026-01-01T00:00:00.000Z')
    const createdElement = {
      id: 31,
      version: 1,
      name: 'Inline Selection',
      status: ElementStatus.READY,
      type: ElementType.SELECTION,
      content: 'Inline selection content',
      explanation: null,
      basePoints: true,
      pointsMultiplier: 1,
      options: {
        hasSampleSolution: false,
        numberOfInputs: 2,
      },
      answerCollectionId: 101,
      answerCollectionItems: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    }
    const elementUpsert = vi.fn().mockResolvedValue(createdElement)
    const elementFindUnique = vi.fn().mockResolvedValue({
      ...createdElement,
      answerCollection: {
        id: 101,
        entries: [
          { id: 201, value: 'A' },
          { id: 202, value: 'B' },
        ],
      },
      answerCollectionItems: [],
    })
    const liveQuizCreate = vi.fn().mockResolvedValue({ id: 'new-live-quiz-1' })
    const tx = {
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      activityLogEntry: {
        create: activityLogEntryCreate,
      },
      element: {
        findUnique: elementFindUnique,
        upsert: elementUpsert,
      },
      liveQuiz: {
        create: liveQuizCreate,
      },
    }
    const transaction = vi
      .fn()
      .mockImplementation(async (callback) => callback(tx))
    const prisma = {
      activityTemplate: {
        findUnique: activityTemplateFindUnique,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      course: {
        findUnique: courseFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createLiveQuizFromTemplate(
        templateCreationInput({
          courseId: null,
          blocks: [
            {
              order: 0,
              timeLimit: null,
              elements: [
                {
                  order: 0,
                  useExistingElement: false,
                  existingElementId: null,
                  useNewElement: true,
                  newElement: {
                    status: ElementStatus.READY,
                    type: ElementType.SELECTION,
                    name: 'Inline Selection',
                    content: 'Inline selection content',
                    explanation: null,
                    basePoints: true,
                    pointsMultiplier: 1,
                    tags: [],
                    selectionOptions: {
                      hasSampleSolution: false,
                      answerCollection: 101,
                      numberOfInputs: 2,
                      correctAnswers: undefined,
                    },
                  },
                },
              ],
            },
          ],
        })
      )
    ).resolves.toEqual({ createLiveQuizFromTemplate: 'new-live-quiz-1' })

    expect(derivedPermissionFindFirst).toHaveBeenCalledTimes(2)
    expect(activityTemplateFindUnique).toHaveBeenCalledTimes(2)
    expect(elementUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          answerCollection: { connect: { id: 101 } },
        }),
      })
    )
    expect(liveQuizCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        blocks: {
          create: [
            {
              order: 0,
              timeLimit: null,
              elements: {
                create: [
                  expect.objectContaining({
                    elementType: ElementType.SELECTION,
                    order: 0,
                    element: { connect: { id: 31 } },
                  }),
                ],
              },
            },
          ],
        },
      }),
    })
  })
})
