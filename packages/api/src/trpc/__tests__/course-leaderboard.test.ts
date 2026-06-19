import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'

const updateWeeklyTimelineEntriesCourse = vi.hoisted(() => vi.fn())

vi.mock('../../services/hatchetHandlers.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/hatchetHandlers.js')>()
  return {
    ...actual,
    updateWeeklyTimelineEntriesCourse,
  }
})

const { appRouter } = await import('../root.js')

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

describe('course leaderboard routers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns null when course leaderboard read permission is missing', async () => {
    const courseFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.leaderboard({
        courseId: 'course-1',
        leaderboardType: 'course',
      })
    ).resolves.toEqual({ courseLeaderboard: null })

    expect(courseFindUnique).not.toHaveBeenCalled()
  })

  test('returns course leaderboard entries for readers', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const courseFindUnique = vi.fn().mockResolvedValue({
      leaderboard: [
        {
          id: 11,
          participantId: 'participant-1',
          score: 20,
          participation: {
            participant: {
              username: 'Beta',
              email: 'beta@example.com',
              avatar: null,
            },
          },
        },
        {
          id: 12,
          participantId: 'participant-2',
          score: 10,
          participation: {
            participant: {
              username: 'Alpha',
              email: null,
              avatar: 'avatar.png',
            },
          },
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.leaderboard({
        courseId: 'course-1',
        leaderboardType: 'course',
      })
    ).resolves.toEqual({
      courseLeaderboard: {
        numOfActiveParticipants: 2,
        averageActiveScore: 15,
        leaderboard: [
          {
            id: 11,
            participantId: 'participant-1',
            username: 'Beta',
            email: 'beta@example.com',
            avatar: null,
            score: 20,
            rank: 1,
          },
          {
            id: 12,
            participantId: 'participant-2',
            username: 'Alpha',
            email: null,
            avatar: 'avatar.png',
            score: 10,
            rank: 2,
          },
        ],
      },
    })
    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        courseId: 'course-1',
        userId: user.sub,
        permissionLevel: {
          in: [
            PermissionLevel.READ,
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: {
        leaderboard: {
          where: { participation: { isActive: true } },
          orderBy: { score: 'desc' },
          select: {
            id: true,
            participantId: true,
            score: true,
            participation: {
              select: {
                participant: {
                  select: {
                    email: true,
                    username: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  test('updates weekly timeline entries for course readers', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
    } as unknown as TRPCContext['prisma']
    updateWeeklyTimelineEntriesCourse.mockResolvedValue(true)
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.updateWeeklyTimelineEntries({
        courseId: 'course-1',
      })
    ).resolves.toEqual({ updateWeeklyTimelineEntriesCourse: true })

    expect(updateWeeklyTimelineEntriesCourse).toHaveBeenCalledWith(
      { courseId: 'course-1' },
      prisma
    )
  })

  test('returns null when weekly timeline update permission is missing', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.updateWeeklyTimelineEntries({
        courseId: 'course-1',
      })
    ).resolves.toEqual({ updateWeeklyTimelineEntriesCourse: null })

    expect(updateWeeklyTimelineEntriesCourse).not.toHaveBeenCalled()
  })
})
