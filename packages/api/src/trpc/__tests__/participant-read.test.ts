import { Locale, UserRole } from '@klicker-uzh/prisma/client'
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

const levelData = {
  id: 1,
  index: 1,
  name: 'Starter',
  avatar: null,
  requiredXp: 0,
  nextLevel: {
    id: 2,
    index: 2,
    name: 'Next',
    avatar: 'next.svg',
    requiredXp: 9000,
  },
}

describe('participant read routers', () => {
  test('returns null self without an authenticated user', async () => {
    const caller = appRouter.createCaller({})

    await expect(caller.participant.self()).resolves.toEqual({ self: null })
  })

  test('returns participant self with course participation flags', async () => {
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'course-1' }),
      },
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'participant-1',
          email: 'student@example.com',
          username: 'student1',
          locale: Locale.en,
          avatar: 'avatar.svg',
          avatarSettings: {
            skinTone: 'tone',
            eyes: 'eyes',
            mouth: 'mouth',
            hair: 'hair',
            facialHair: 'facialHair',
            accessory: 'accessory',
            hairColor: 'hairColor',
            clothing: 'clothing',
            clothingColor: 'clothingColor',
          },
          isActive: true,
          isProfilePublic: false,
          xp: 0,
          participations: [{ isActive: true }],
          accounts: [{ ssoEmail: 'student@uzh.ch' }],
        }),
      },
      level: {
        findUnique: vi.fn().mockResolvedValue(levelData),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.self({ liveQuizId: 'quiz-1' })
    ).resolves.toEqual({
      self: {
        id: 'participant-1',
        role: UserRole.PARTICIPANT,
        scopeQuizId: null,
        isCourseParticipant: true,
        isCourseParticipationActive: true,
        email: 'student@example.com',
        institutionalEmail: 'student@uzh.ch',
        username: 'student1',
        locale: Locale.en,
        avatar: 'avatar.svg',
        avatarSettings: {
          skinTone: 'tone',
          eyes: 'eyes',
          mouth: 'mouth',
          hair: 'hair',
          facialHair: 'facialHair',
          accessory: 'accessory',
          hairColor: 'hairColor',
          clothing: 'clothing',
          clothingColor: 'clothingColor',
        },
        isActive: true,
        isProfilePublic: false,
        xp: 0,
        level: 1,
        levelData,
      },
    })
  })

  test('returns temporary participant self only for a scoped live quiz', async () => {
    const prisma = {
      temporaryLeaderboardEntry: {
        findUnique: vi.fn().mockResolvedValue({
          avatar: 'temporary.svg',
          quizId: 'quiz-1',
          username: 'Guest 1',
        }),
      },
      level: {
        findUnique: vi.fn().mockResolvedValue(levelData),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        prisma,
        role: UserRole.TEMPORARY_PARTICIPANT,
        sub: 'temporary-1',
      })
    )

    await expect(
      caller.participant.self({ liveQuizId: 'quiz-1' })
    ).resolves.toEqual({
      self: {
        id: 'temporary-1',
        role: UserRole.TEMPORARY_PARTICIPANT,
        scopeQuizId: 'quiz-1',
        isCourseParticipant: false,
        isCourseParticipationActive: false,
        email: null,
        institutionalEmail: null,
        username: 'Guest 1',
        locale: null,
        avatar: 'temporary.svg',
        avatarSettings: null,
        isActive: true,
        isProfilePublic: true,
        xp: null,
        level: 1,
        levelData,
      },
    })
  })

  test('returns participant course list', async () => {
    const prisma = {
      participant: {
        findUnique: vi.fn().mockResolvedValue({
          participations: [
            {
              course: {
                id: 'course-1',
                isArchived: false,
                displayName: 'Course One',
                description: 'Description',
              },
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.participant.courses()).resolves.toEqual({
      participantCourses: [
        {
          id: 'course-1',
          isArchived: false,
          displayName: 'Course One',
          description: 'Description',
        },
      ],
    })
  })

  test('returns practice courses with element stacks ordered by end date', async () => {
    const prisma = {
      participation: {
        findMany: vi.fn().mockResolvedValue([
          {
            course: {
              id: 'course-old',
              displayName: 'Old Course',
              endDate: new Date('2025-01-01T00:00:00.000Z'),
              elementStacks: [{ id: 1 }],
            },
          },
          {
            course: {
              id: 'course-empty',
              displayName: 'Empty Course',
              endDate: new Date('2026-01-01T00:00:00.000Z'),
              elementStacks: [],
            },
          },
          {
            course: {
              id: 'course-new',
              displayName: 'New Course',
              endDate: new Date('2026-01-01T00:00:00.000Z'),
              elementStacks: [{ id: 2 }],
            },
          },
        ]),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.participant.practiceCourses()).resolves.toEqual({
      practiceCourses: [
        { id: 'course-new', displayName: 'New Course' },
        { id: 'course-old', displayName: 'Old Course' },
      ],
    })
  })

  test('rejects participant course reads for lecturers', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(caller.participant.courses()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
