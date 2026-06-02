import {
  Locale,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
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
})
