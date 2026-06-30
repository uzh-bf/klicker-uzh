import {
  ElementInstanceType,
  ElementType,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
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

function contentInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    elementId: 17,
    elementType: ElementType.CONTENT,
    order: 0,
    type: ElementInstanceType.LIVE_QUIZ,
    elementData: {},
    options: {},
    results: {},
    anonymousResults: {},
    ...overrides,
  }
}

function liveQuizActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'live-quiz-1',
    displayName: 'Live Quiz Display',
    description: 'Live quiz description',
    pointsMultiplier: 2,
    defaultPoints: 10,
    defaultCorrectPoints: 5,
    maxBonusPoints: 3,
    timeToZeroBonus: 20,
    isGamificationEnabled: true,
    isConfusionFeedbackEnabled: true,
    isLiveQAEnabled: false,
    isModerationEnabled: true,
    blocks: [
      {
        order: 0,
        timeLimit: 30,
        elements: [contentInstance()],
      },
    ],
    ...overrides,
  }
}

function conversionInput(overrides: Record<string, unknown> = {}) {
  return {
    activityId: 'live-quiz-1',
    activityType: ActivityType.LIVE_QUIZ,
    templateName: 'Converted Template',
    templateDescription: 'Template description',
    templateInstructions: 'Template instructions',
    copyBeforeConversion: false,
    ...overrides,
  }
}

function adminPermission() {
  return {
    permissionLevel: PermissionLevel.ADMIN,
  }
}

describe('manage template conversion router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
  })

  test('reports when no additional resources are required', async () => {
    const derivedPermissionFindFirst = vi
      .fn()
      .mockResolvedValue(adminPermission())
    const liveQuizFindUnique = vi.fn().mockResolvedValue(liveQuizActivity())
    const answerCollectionFindMany = vi.fn()
    const answerCollectionEntryFindMany = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      answerCollection: {
        findMany: answerCollectionFindMany,
      },
      answerCollectionEntry: {
        findMany: answerCollectionEntryFindMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.checkTemplateInfoAvailable({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      checkTemplateInfoAvailable: {
        noInstances: false,
        noResourcesRequired: true,
        resourcesRequiredExist: false,
        resourcesRequiredMissing: false,
      },
    })

    expect(derivedPermissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(liveQuizFindUnique).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })
    expect(answerCollectionFindMany).not.toHaveBeenCalled()
    expect(answerCollectionEntryFindMany).not.toHaveBeenCalled()
  })

  test('reports when required template resources are missing', async () => {
    const selectionInstance = contentInstance({
      elementType: ElementType.SELECTION,
      elementData: {
        options: {
          answerCollection: { id: 42 },
          answerCollectionSolutionIds: [7],
        },
      },
    })
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(adminPermission()),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue(
          liveQuizActivity({
            blocks: [
              {
                order: 0,
                timeLimit: 30,
                elements: [selectionInstance],
              },
            ],
          })
        ),
      },
      answerCollection: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      answerCollectionEntry: {
        findMany: vi.fn().mockResolvedValue([{ id: 7 }]),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.checkTemplateInfoAvailable({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      checkTemplateInfoAvailable: {
        noInstances: false,
        noResourcesRequired: false,
        resourcesRequiredExist: false,
        resourcesRequiredMissing: true,
      },
    })
  })

  test('creates a template copy of a live quiz and recomputes permissions', async () => {
    const liveQuizCreate = vi.fn().mockResolvedValue({ id: 'template-copy-1' })
    const tx = {
      liveQuiz: {
        create: liveQuizCreate,
      },
    }
    const transaction = vi
      .fn()
      .mockImplementation(async (callback) => callback(tx))
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(adminPermission()),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue(liveQuizActivity()),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createActivityTemplate(
        conversionInput({ copyBeforeConversion: true })
      )
    ).resolves.toEqual({ createActivityTemplate: true })

    expect(liveQuizCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Converted Template',
        displayName: 'Live Quiz Display',
        description: 'Live quiz description',
        status: PublicationStatus.TEMPLATE,
        pointsMultiplier: 2,
        defaultPoints: 10,
        defaultCorrectPoints: 5,
        maxBonusPoints: 3,
        timeToZeroBonus: 20,
        isGamificationEnabled: true,
        isConfusionFeedbackEnabled: true,
        isLiveQAEnabled: false,
        isModerationEnabled: true,
        owner: { connect: { id: user.id } },
        templateInfo: {
          create: {
            description: 'Template description',
            instructions: 'Template instructions',
          },
        },
        blocks: {
          create: [
            expect.objectContaining({
              order: 0,
              timeLimit: 30,
              elements: {
                create: [
                  expect.objectContaining({
                    elementType: ElementType.CONTENT,
                    order: 0,
                    type: ElementInstanceType.LIVE_QUIZ,
                    element: { connect: { id: 17 } },
                    owner: { connect: { id: user.id } },
                  }),
                ],
              },
            }),
          ],
        },
      }),
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { liveQuizId: 'template-copy-1', userId: user.id },
      tx
    )
  })

  test('converts an existing live quiz into a template', async () => {
    const activityTemplateCreate = vi
      .fn()
      .mockResolvedValue({ id: 'template-1' })
    const liveQuizUpdate = vi.fn().mockResolvedValue({ id: 'live-quiz-1' })
    const tx = {
      activityTemplate: {
        create: activityTemplateCreate,
      },
      liveQuiz: {
        update: liveQuizUpdate,
      },
    }
    const transaction = vi
      .fn()
      .mockImplementation(async (callback) => callback(tx))
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(adminPermission()),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue(liveQuizActivity()),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createActivityTemplate(conversionInput())
    ).resolves.toEqual({ createActivityTemplate: true })

    expect(activityTemplateCreate).toHaveBeenCalledWith({
      data: {
        description: 'Template description',
        instructions: 'Template instructions',
        liveQuiz: { connect: { id: 'live-quiz-1' } },
        practiceQuiz: undefined,
        microLearning: undefined,
        groupActivity: undefined,
        answerCollections: undefined,
        answerCollectionItems: undefined,
      },
    })
    expect(liveQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      data: {
        name: 'Converted Template',
        status: PublicationStatus.TEMPLATE,
      },
    })
  })

  test('returns null when the user lacks admin access', async () => {
    const liveQuizFindUnique = vi.fn()
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createActivityTemplate(conversionInput())
    ).resolves.toEqual({ createActivityTemplate: null })

    expect(liveQuizFindUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
})
