import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
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

  test('returns bookmarks page course data and bookmarked stack DTOs', async () => {
    const courseFindUnique = vi.fn().mockResolvedValue({
      id: 'course-1',
      displayName: 'Course 1',
      description: 'Course description',
      color: '#0028a5',
      owner: { shortname: 'owner' },
    })
    const participationFindUnique = vi.fn().mockResolvedValue({
      bookmarkedElementStacks: [
        {
          id: 7,
          type: ElementStackType.PRACTICE_QUIZ,
          displayName: 'Stack 1',
          description: 'Stack description',
          order: 2,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.FLASHCARD,
              elementData: {
                id: '1-v1',
                elementId: 1,
                name: 'Flashcard',
                type: ElementType.FLASHCARD,
                content: 'Front',
                explanation: 'Back',
                basePoints: true,
                pointsMultiplier: 1,
                options: {},
              },
            },
          ],
        },
      ],
    })
    const prisma = {
      course: { findUnique: courseFindUnique },
      participation: { findUnique: participationFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.bookmarksPageData({ courseId: 'course-1' })
    ).resolves.toEqual({
      course: {
        id: 'course-1',
        displayName: 'Course 1',
        description: 'Course description',
        color: '#0028a5',
        owner: { shortname: 'owner' },
      },
      stacks: [
        {
          id: 7,
          type: ElementStackType.PRACTICE_QUIZ,
          displayName: 'Stack 1',
          description: 'Stack description',
          order: 2,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.FLASHCARD,
              elementData: {
                __typename: 'FlashcardElementData',
                id: '1-v1',
                elementId: 1,
                name: 'Flashcard',
                type: ElementType.FLASHCARD,
                content: 'Front',
                explanation: 'Back',
                basePoints: true,
                pointsMultiplier: 1,
                options: {},
              },
            },
          ],
        },
      ],
    })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: {
        id: true,
        displayName: true,
        description: true,
        color: true,
        owner: {
          select: {
            shortname: true,
          },
        },
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
        bookmarkedElementStacks: {
          select: {
            id: true,
            type: true,
            displayName: true,
            description: true,
            order: true,
            elements: {
              orderBy: {
                order: 'asc',
              },
              select: {
                id: true,
                type: true,
                elementType: true,
                elementData: true,
              },
            },
          },
        },
      },
    })
  })

  test('returns course data with empty stacks when no participation exists', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          displayName: 'Course 1',
          description: null,
          color: '#0028a5',
          owner: { shortname: 'owner' },
        }),
      },
      participation: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.bookmarksPageData({ courseId: 'course-1' })
    ).resolves.toEqual({
      course: {
        id: 'course-1',
        displayName: 'Course 1',
        description: null,
        color: '#0028a5',
        owner: { shortname: 'owner' },
      },
      stacks: [],
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
    await expect(
      caller.participant.bookmarksPageData({
        courseId: 'course-1',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
