import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { propagateActivityToElements } from '@klicker-uzh/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()

  return {
    ...actual,
    propagateActivityToElements: vi.fn(),
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

function deleteTemplateInput() {
  return {
    activityId: 'template-live-quiz-1',
    activityType: ActivityType.LIVE_QUIZ,
  }
}

describe('manage template deletion router', () => {
  beforeEach(() => {
    vi.mocked(propagateActivityToElements).mockClear()
  })

  test('deletes a template live quiz and propagates element permissions', async () => {
    const blocks = [
      {
        elements: [{ elementId: 17 }, { elementId: 23 }],
      },
    ]
    const derivedPermissionFindFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.ADMIN,
    })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      id: 'template-live-quiz-1',
      blocks,
    })
    const liveQuizDelete = vi
      .fn()
      .mockResolvedValue({ id: 'template-live-quiz-1' })
    const tx = {
      liveQuiz: {
        delete: liveQuizDelete,
      },
    }
    const transaction = vi
      .fn()
      .mockImplementation(async (callback) => callback(tx))
    const prisma = {
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.deleteTemplate(deleteTemplateInput())
    ).resolves.toEqual({ deleteActivityTemplate: 'template-live-quiz-1' })

    expect(derivedPermissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'template-live-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(liveQuizFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'template-live-quiz-1',
        status: 'TEMPLATE',
      },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })
    expect(liveQuizDelete).toHaveBeenCalledWith({
      where: { id: 'template-live-quiz-1' },
    })
    expect(propagateActivityToElements).toHaveBeenCalledWith(
      { stacks: blocks, updateAccessRequests: true },
      tx
    )
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
    })
  })

  test('returns null when the user lacks admin access', async () => {
    const derivedPermissionFindFirst = vi.fn().mockResolvedValue(null)
    const liveQuizFindUnique = vi.fn()
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.deleteTemplate(deleteTemplateInput())
    ).resolves.toEqual({ deleteActivityTemplate: null })

    expect(liveQuizFindUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  test('returns null when the template activity is missing', async () => {
    const derivedPermissionFindFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.ADMIN,
    })
    const liveQuizFindUnique = vi.fn().mockResolvedValue(null)
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.deleteTemplate(deleteTemplateInput())
    ).resolves.toEqual({ deleteActivityTemplate: null })

    expect(transaction).not.toHaveBeenCalled()
  })

  test('propagates transaction failures like the GraphQL mutation', async () => {
    const derivedPermissionFindFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.ADMIN,
    })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      id: 'template-live-quiz-1',
      blocks: [],
    })
    const transaction = vi.fn().mockRejectedValue(new Error('delete failed'))
    const prisma = {
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.deleteTemplate(deleteTemplateInput())
    ).rejects.toThrow('delete failed')
  })
})
