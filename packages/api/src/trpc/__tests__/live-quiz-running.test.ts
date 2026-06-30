import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.FULL_ACCESS,
  catalystInstitutional: false,
  catalystIndividual: false,
}

function createContext(prisma: TRPCContext['prisma']): TRPCContext {
  return { prisma, user }
}

describe('running live quiz router', () => {
  test('returns published live quizzes with execute-or-higher permissions', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          liveQuiz: {
            id: 'quiz-1',
            name: 'Running quiz',
          },
        },
      ],
    })
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.liveQuiz.running()).resolves.toEqual({
      liveQuizzes: [
        {
          id: 'quiz-1',
          name: 'Running quiz',
        },
      ],
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: user.sub },
      select: {
        objects: {
          where: {
            liveQuizId: { not: null },
            permissionLevel: {
              in: [
                PermissionLevel.EXECUTE,
                PermissionLevel.WRITE,
                PermissionLevel.ADMIN,
                PermissionLevel.OWNER,
              ],
            },
            liveQuiz: { status: 'PUBLISHED' },
          },
          select: {
            liveQuiz: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })
  })

  test('returns an empty list when the user has no running live quizzes', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ objects: [] }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.liveQuiz.running()).resolves.toEqual({
      liveQuizzes: [],
    })
  })
})
