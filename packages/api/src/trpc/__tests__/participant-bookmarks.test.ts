import { UserRole } from '@klicker-uzh/prisma/client'
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

describe('participant bookmark routers', () => {
  test('returns practice quiz bookmark stack ids for a participant', async () => {
    const prisma = {
      participation: {
        findUnique: vi.fn().mockResolvedValue({
          bookmarkedElementStacks: [{ id: 1 }, { id: 3 }],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.practiceQuizBookmarks({
        courseId: 'course-1',
        quizId: 'quiz-1',
      })
    ).resolves.toEqual([1, 3])

    expect(prisma?.participation.findUnique).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      select: {
        bookmarkedElementStacks: {
          where: {
            practiceQuizId: 'quiz-1',
          },
          select: { id: true },
        },
      },
    })
  })

  test('uses all course bookmarks when no practice quiz id is provided', async () => {
    const prisma = {
      participation: {
        findUnique: vi.fn().mockResolvedValue({
          bookmarkedElementStacks: [{ id: 2 }],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.practiceQuizBookmarks({
        courseId: 'course-1',
        quizId: null,
      })
    ).resolves.toEqual([2])

    expect(prisma?.participation.findUnique).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      select: {
        bookmarkedElementStacks: {
          where: {
            practiceQuizId: undefined,
          },
          select: { id: true },
        },
      },
    })
  })

  test('returns null when the participant has no course participation', async () => {
    const prisma = {
      participation: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.practiceQuizBookmarks({
        courseId: 'course-1',
        quizId: 'quiz-1',
      })
    ).resolves.toBeNull()
  })

  test('bookmarks an element stack and returns the updated stack ids', async () => {
    const update = vi.fn().mockResolvedValue({
      bookmarkedElementStacks: [{ id: 1 }, { id: 2 }],
    })
    const prisma = {
      participation: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.bookmarkElementStack({
        courseId: 'course-1',
        stackId: 2,
        bookmarked: true,
      })
    ).resolves.toEqual([1, 2])

    expect(update).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      data: {
        bookmarkedElementStacks: {
          connect: { id: 2 },
        },
      },
      select: {
        bookmarkedElementStacks: {
          select: { id: true },
        },
      },
    })
  })

  test('removes an element stack bookmark and returns the updated stack ids', async () => {
    const update = vi.fn().mockResolvedValue({
      bookmarkedElementStacks: [{ id: 1 }],
    })
    const prisma = {
      participation: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.bookmarkElementStack({
        courseId: 'course-1',
        stackId: 2,
        bookmarked: false,
      })
    ).resolves.toEqual([1])

    expect(update).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      data: {
        bookmarkedElementStacks: {
          disconnect: { id: 2 },
        },
      },
      select: {
        bookmarkedElementStacks: {
          select: { id: true },
        },
      },
    })
  })

  test('rejects bookmark procedures for non-participants', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.practiceQuizBookmarks({
        courseId: 'course-1',
        quizId: 'quiz-1',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.bookmarkElementStack({
        courseId: 'course-1',
        stackId: 1,
        bookmarked: true,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
