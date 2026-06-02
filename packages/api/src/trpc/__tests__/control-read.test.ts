import {
  ElementBlockStatus,
  Locale,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { createHmac } from 'node:crypto'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  id: 'user-1',
  email: 'lecturer@example.com',
  sendProjectUpdates: true,
  shortname: 'lecturer',
  role: UserRole.USER,
  locale: Locale.en,
  firstLogin: false,
  catalystInstitutional: false,
  catalystIndividual: true,
  catalystTier: 'pro',
  publicPreview: true,
  privatePreview: false,
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

describe('control read routers', () => {
  test('returns the current user profile DTO', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
      },
      chatbot: {
        count: vi.fn().mockResolvedValue(3),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.user.profile()).resolves.toEqual({
      id: user.id,
      email: user.email,
      sendProjectUpdates: user.sendProjectUpdates,
      shortname: user.shortname,
      role: user.role,
      locale: user.locale,
      firstLogin: user.firstLogin,
      catalyst: true,
      catalystTier: user.catalystTier,
      publicPreview: user.publicPreview,
      privatePreview: user.privatePreview,
      numChatbots: 3,
    })
  })

  test('returns the current lecturer control course list', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          courses: [
            {
              id: 'course-1',
              name: 'Course 1',
              displayName: 'Course One',
              description: 'Description',
              isArchived: false,
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.course.controlCourses()).resolves.toEqual({
      controlCourses: [
        {
          id: 'course-1',
          name: 'Course 1',
          displayName: 'Course One',
          description: 'Description',
          isArchived: false,
        },
      ],
    })
  })

  test('returns a control course when execute permission exists', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.EXECUTE,
        }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          name: 'Course 1',
          liveQuizzes: [
            {
              id: 'quiz-1',
              name: 'Quiz 1',
              status: PublicationStatus.PUBLISHED,
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.controlCourse({ courseId: 'course-1' })
    ).resolves.toEqual({
      controlCourse: {
        id: 'course-1',
        name: 'Course 1',
        liveQuizzes: [
          {
            id: 'quiz-1',
            name: 'Quiz 1',
            status: PublicationStatus.PUBLISHED,
          },
        ],
      },
    })
  })

  test('returns null for a control course without execute permission', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.controlCourse({ courseId: 'course-1' })
    ).resolves.toEqual({ controlCourse: null })
  })

  test('returns unassigned live quizzes for the current lecturer', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          liveQuizzes: [
            {
              id: 'quiz-1',
              name: 'Quiz 1',
              status: PublicationStatus.PUBLISHED,
            },
            {
              id: 'quiz-2',
              name: 'Quiz 2',
              status: PublicationStatus.DRAFT,
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.liveQuiz.unassigned()).resolves.toEqual({
      liveQuizzes: [
        {
          id: 'quiz-1',
          name: 'Quiz 1',
          status: PublicationStatus.PUBLISHED,
        },
        {
          id: 'quiz-2',
          name: 'Quiz 2',
          status: PublicationStatus.DRAFT,
        },
      ],
    })
  })

  test('returns a running control live quiz when read permission exists', async () => {
    const expiresAt = new Date('2026-01-01T00:00:00.000Z')
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.READ,
        }),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          name: 'Quiz 1',
          displayName: 'Quiz One',
          course: {
            id: 'course-1',
            displayName: 'Course One',
          },
          activeBlock: {
            id: 1,
            order: 0,
          },
          blocks: [
            {
              id: 1,
              order: 0,
              status: ElementBlockStatus.SCHEDULED,
              expiresAt,
              timeLimit: 30,
              randomSelection: null,
              execution: null,
              elements: [
                {
                  id: 10,
                  elementData: { name: 'Question 1' },
                },
              ],
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.liveQuiz.control({ id: 'quiz-1' })).resolves.toEqual({
      controlLiveQuiz: {
        id: 'quiz-1',
        name: 'Quiz 1',
        displayName: 'Quiz One',
        course: {
          id: 'course-1',
          displayName: 'Course One',
        },
        activeBlock: {
          id: 1,
          order: 0,
        },
        blocks: [
          {
            id: 1,
            order: 0,
            status: ElementBlockStatus.SCHEDULED,
            expiresAt,
            timeLimit: 30,
            randomSelection: null,
            execution: null,
            elements: [
              {
                id: 10,
                elementData: { name: 'Question 1' },
              },
            ],
          },
        ],
      },
    })
  })

  test('returns null for a control live quiz without read permission', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.liveQuiz.control({ id: 'quiz-1' })).resolves.toEqual({
      controlLiveQuiz: null,
    })
  })

  test('returns live quiz embedding info when read permission exists', async () => {
    process.env.APP_SECRET = 'test-secret'
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.READ,
        }),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          namespace: 'namespace-1',
          blocks: [
            {
              elements: [
                { id: 10, elementData: { name: 'Question 1' } },
                { id: 11, elementData: { name: 'Question 2' } },
              ],
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))
    const hmac = createHmac('sha256', 'test-secret')
      .update('namespace-1quiz-1')
      .digest('hex')

    await expect(
      caller.liveQuiz.embeddingInfo({ id: 'quiz-1' })
    ).resolves.toEqual({
      embeddingInfo: {
        id: 'quiz-1',
        hmac,
        instances: [
          { id: 10, name: 'Question 1' },
          { id: 11, name: 'Question 2' },
        ],
      },
    })
  })

  test('returns null for live quiz embedding info without read permission', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.liveQuiz.embeddingInfo({ id: 'quiz-1' })
    ).resolves.toEqual({
      embeddingInfo: null,
    })
  })
})
