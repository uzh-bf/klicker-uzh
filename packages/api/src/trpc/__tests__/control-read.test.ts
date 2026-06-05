import {
  ElementBlockStatus,
  Locale,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
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

  test('returns the current manage user course list with permission flags', async () => {
    const activeStart = new Date('2026-02-01T00:00:00.000Z')
    const activeEnd = new Date('2026-06-01T00:00:00.000Z')
    const archivedStart = new Date('2025-02-01T00:00:00.000Z')
    const archivedEnd = new Date('2025-06-01T00:00:00.000Z')
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          course: {
            id: 'course-archived',
            name: 'Archived Course',
            displayName: 'Archived Course',
            color: '#cccccc',
            isArchived: true,
            isGamificationEnabled: false,
            isAssessmentEnabled: false,
            isGroupCreationEnabled: false,
            description: 'Archived description',
            startDate: archivedStart,
            endDate: archivedEnd,
            createdAt: archivedStart,
            updatedAt: archivedEnd,
            _count: {
              permissions: 2,
            },
          },
          derived: false,
          directPermission: {
            userGroupId: null,
          },
          permissionLevel: PermissionLevel.READ,
        },
        {
          course: {
            id: 'course-active',
            name: 'Active Course',
            displayName: 'Active Course',
            color: '#0028a5',
            isArchived: false,
            isGamificationEnabled: true,
            isAssessmentEnabled: true,
            isGroupCreationEnabled: true,
            description: 'Active description',
            startDate: activeStart,
            endDate: activeEnd,
            createdAt: activeStart,
            updatedAt: activeEnd,
            _count: {
              permissions: 3,
            },
          },
          derived: false,
          directPermission: {
            userGroupId: null,
          },
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.course.userCourses()).resolves.toEqual({
      userCourses: [
        {
          id: 'course-active',
          name: 'Active Course',
          displayName: 'Active Course',
          color: '#0028a5',
          isArchived: false,
          isGamificationEnabled: true,
          isAssessmentEnabled: true,
          isGroupCreationEnabled: true,
          description: 'Active description',
          startDate: activeStart,
          endDate: activeEnd,
          createdAt: activeStart,
          updatedAt: activeEnd,
          derivedAccess: false,
          numSharedUsers: 2,
          permissionLevel: PermissionLevel.ADMIN,
          isOwner: false,
          isManager: true,
          isEditor: true,
          isShared: true,
          isRemovable: true,
        },
        {
          id: 'course-archived',
          name: 'Archived Course',
          displayName: 'Archived Course',
          color: '#cccccc',
          isArchived: true,
          isGamificationEnabled: false,
          isAssessmentEnabled: false,
          isGroupCreationEnabled: false,
          description: 'Archived description',
          startDate: archivedStart,
          endDate: archivedEnd,
          createdAt: archivedStart,
          updatedAt: archivedEnd,
          derivedAccess: false,
          numSharedUsers: 1,
          permissionLevel: PermissionLevel.READ,
          isOwner: false,
          isManager: false,
          isEditor: false,
          isShared: true,
          isRemovable: true,
        },
      ],
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: {
        objects: {
          where: { courseId: { not: null } },
          select: {
            course: {
              select: {
                id: true,
                name: true,
                displayName: true,
                color: true,
                isArchived: true,
                isGamificationEnabled: true,
                isAssessmentEnabled: true,
                isGroupCreationEnabled: true,
                description: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                  select: {
                    permissions: true,
                  },
                },
              },
            },
            derived: true,
            directPermission: {
              select: {
                userGroupId: true,
              },
            },
            permissionLevel: true,
          },
          orderBy: [{ course: { endDate: 'desc' } }],
        },
      },
    })
  })

  test('returns active user courses for activity course selectors', async () => {
    const startDate = new Date('2026-02-01T00:00:00.000Z')
    const endDate = new Date('2026-08-01T00:00:00.000Z')
    const groupDeadlineDate = new Date('2026-03-01T00:00:00.000Z')
    const updatedAt = new Date('2026-01-15T00:00:00.000Z')
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          course: {
            id: 'course-active',
            name: 'Active Course',
            displayName: 'Active Course',
            color: '#0028a5',
            pinCode: 123456789,
            isArchived: false,
            isGamificationEnabled: true,
            isAssessmentEnabled: false,
            isGroupCreationEnabled: true,
            description: 'Active description',
            startDate,
            endDate,
            groupDeadlineDate,
            createdAt: startDate,
            updatedAt,
          },
          permissionLevel: PermissionLevel.WRITE,
        },
      ],
    })
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.course.activeUserCourses()).resolves.toEqual({
      activeUserCourses: [
        {
          id: 'course-active',
          name: 'Active Course',
          displayName: 'Active Course',
          color: '#0028a5',
          pinCode: 123456789,
          isArchived: false,
          isGamificationEnabled: true,
          isAssessmentEnabled: false,
          isGroupCreationEnabled: true,
          description: 'Active description',
          startDate,
          endDate,
          groupDeadlineDate,
          createdAt: startDate,
          updatedAt,
          isOwner: false,
          isManager: false,
          isEditor: true,
          isShared: true,
        },
      ],
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: {
        objects: {
          where: {
            courseId: { not: null },
            course: {
              endDate: { gte: expect.any(Date) },
              isArchived: false,
            },
          },
          select: {
            course: {
              select: {
                id: true,
                name: true,
                displayName: true,
                color: true,
                pinCode: true,
                isArchived: true,
                isGamificationEnabled: true,
                isAssessmentEnabled: true,
                isGroupCreationEnabled: true,
                description: true,
                startDate: true,
                endDate: true,
                groupDeadlineDate: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            permissionLevel: true,
          },
          orderBy: [
            { course: { startDate: 'asc' } },
            { course: { name: 'asc' } },
          ],
        },
      },
    })
  })

  test('adds linked activity course when activity write access is valid', async () => {
    const activeStartDate = new Date('2026-02-01T00:00:00.000Z')
    const linkedStartDate = new Date('2026-04-01T00:00:00.000Z')
    const activeEndDate = new Date('2026-08-01T00:00:00.000Z')
    const linkedEndDate = new Date('2026-10-01T00:00:00.000Z')
    const activeGroupDeadlineDate = new Date('2026-03-01T00:00:00.000Z')
    const linkedGroupDeadlineDate = new Date('2026-05-01T00:00:00.000Z')
    const activeUpdatedAt = new Date('2026-01-15T00:00:00.000Z')
    const linkedUpdatedAt = new Date('2026-03-15T00:00:00.000Z')
    const activeCourse = {
      id: 'course-active',
      name: 'Active Course',
      displayName: 'Active Course',
      color: '#0028a5',
      pinCode: 123456789,
      isArchived: false,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      isGroupCreationEnabled: true,
      description: 'Active description',
      startDate: activeStartDate,
      endDate: activeEndDate,
      groupDeadlineDate: activeGroupDeadlineDate,
      createdAt: activeStartDate,
      updatedAt: activeUpdatedAt,
    }
    const linkedCourse = {
      id: 'course-linked',
      name: 'Linked Course',
      displayName: 'Linked Course',
      color: '#dc6027',
      pinCode: 987654321,
      isArchived: false,
      isGamificationEnabled: false,
      isAssessmentEnabled: true,
      isGroupCreationEnabled: false,
      description: 'Linked description',
      startDate: linkedStartDate,
      endDate: linkedEndDate,
      groupDeadlineDate: linkedGroupDeadlineDate,
      createdAt: linkedStartDate,
      updatedAt: linkedUpdatedAt,
    }
    const userFindUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          course: activeCourse,
          permissionLevel: PermissionLevel.OWNER,
        },
      ],
    })
    const derivedPermissionFindFirst = vi
      .fn()
      .mockResolvedValue({ id: 'permission-1' })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      course: linkedCourse,
    })
    const prisma = {
      user: {
        findUnique: userFindUnique,
      },
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.activeUserCourses({
        activityId: 'live-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      activeUserCourses: [
        {
          ...linkedCourse,
          isOwner: false,
          isManager: false,
          isEditor: false,
          isShared: false,
        },
        {
          ...activeCourse,
          isOwner: true,
          isManager: true,
          isEditor: true,
          isShared: false,
        },
      ],
    })

    expect(derivedPermissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(liveQuizFindUnique).toHaveBeenCalledWith({
      where: { id: 'live-1' },
      select: {
        course: {
          select: {
            id: true,
            name: true,
            displayName: true,
            color: true,
            pinCode: true,
            isArchived: true,
            isGamificationEnabled: true,
            isAssessmentEnabled: true,
            isGroupCreationEnabled: true,
            description: true,
            startDate: true,
            endDate: true,
            groupDeadlineDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })
  })

  test('does not fetch linked activity course without activity write access', async () => {
    const userFindUnique = vi.fn().mockResolvedValue({
      objects: [],
    })
    const derivedPermissionFindFirst = vi.fn().mockResolvedValue(null)
    const liveQuizFindUnique = vi.fn()
    const prisma = {
      user: {
        findUnique: userFindUnique,
      },
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.activeUserCourses({
        activityId: 'live-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      activeUserCourses: [],
    })

    expect(derivedPermissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(liveQuizFindUnique).not.toHaveBeenCalled()
  })

  test('returns course activity ids grouped by activity type', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          liveQuiz: { id: 'live-1', name: 'Live Quiz' },
          practiceQuiz: null,
          microLearning: null,
          groupActivity: null,
        },
        {
          liveQuiz: null,
          practiceQuiz: { id: 'practice-1', name: 'Practice Quiz' },
          microLearning: null,
          groupActivity: null,
        },
        {
          liveQuiz: null,
          practiceQuiz: null,
          microLearning: { id: 'micro-1', name: 'Microlearning' },
          groupActivity: null,
        },
        {
          liveQuiz: null,
          practiceQuiz: null,
          microLearning: null,
          groupActivity: { id: 'group-1', name: 'Group Activity' },
        },
      ],
    })
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.activityIds({ courseId: 'course-1' })
    ).resolves.toEqual({
      courseActivityIds: {
        liveQuizzes: [{ id: 'live-1', name: 'Live Quiz' }],
        practiceQuizzes: [{ id: 'practice-1', name: 'Practice Quiz' }],
        microLearnings: [{ id: 'micro-1', name: 'Microlearning' }],
        groupActivities: [{ id: 'group-1', name: 'Group Activity' }],
      },
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      include: {
        objects: {
          where: {
            OR: [
              {
                liveQuiz: {
                  isDeleted: false,
                  courseId: 'course-1',
                },
              },
              {
                practiceQuiz: {
                  isDeleted: false,
                  courseId: 'course-1',
                },
              },
              {
                microLearning: {
                  isDeleted: false,
                  courseId: 'course-1',
                },
              },
              {
                groupActivity: {
                  isDeleted: false,
                  courseId: 'course-1',
                },
              },
            ],
          },
          include: {
            liveQuiz: { select: { id: true, name: true } },
            practiceQuiz: { select: { id: true, name: true } },
            microLearning: { select: { id: true, name: true } },
            groupActivity: { select: { id: true, name: true } },
          },
        },
      },
    })
  })

  test('returns null course activity ids when the user is missing', async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.course.activityIds({})).resolves.toEqual({
      courseActivityIds: null,
    })
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: user.id } })
    )
  })

  test('returns a course deletion summary when read permission exists', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.READ,
    })
    const findUnique = vi.fn().mockResolvedValue({
      _count: {
        participations: 5,
        liveQuizzes: 2,
        practiceQuizzes: 3,
        microLearnings: 4,
        groupActivities: 1,
        leaderboard: 6,
        participantGroups: 7,
      },
    })
    const prisma = {
      derivedPermission: {
        findFirst,
      },
      course: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.summary({ courseId: 'course-1' })
    ).resolves.toEqual({
      courseSummary: {
        numOfParticipations: 5,
        numOfLiveQuizzes: 2,
        numOfPracticeQuizzes: 3,
        numOfMicroLearnings: 4,
        numOfGroupActivities: 1,
        numOfLeaderboardEntries: 6,
        numOfParticipantGroups: 7,
      },
    })

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        courseId: 'course-1',
        userId: user.id,
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: {
        _count: {
          select: {
            liveQuizzes: { where: { isDeleted: false } },
            practiceQuizzes: { where: { isDeleted: false } },
            microLearnings: { where: { isDeleted: false } },
            groupActivities: { where: { isDeleted: false } },
            leaderboard: true,
            participantGroups: true,
            participations: true,
          },
        },
      },
    })
  })

  test('returns null for a course deletion summary without read permission', async () => {
    const findUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      course: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.summary({ courseId: 'course-1' })
    ).resolves.toEqual({
      courseSummary: null,
    })
    expect(findUnique).not.toHaveBeenCalled()
  })

  test('returns public basic course information', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'course-1',
      displayName: 'Course One',
      description: 'Description',
      color: '#0028a5',
      owner: {
        shortname: 'lecturer',
      },
    })
    const prisma = {
      course: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.course.basicCourseInformation({ courseId: 'course-1' })
    ).resolves.toEqual({
      basicCourseInformation: {
        id: 'course-1',
        displayName: 'Course One',
        description: 'Description',
        color: '#0028a5',
        owner: {
          shortname: 'lecturer',
        },
      },
    })

    expect(findUnique).toHaveBeenCalledWith({
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
  })

  test('returns null for missing public basic course information', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.course.basicCourseInformation({ courseId: 'missing-course' })
    ).resolves.toEqual({
      basicCourseInformation: null,
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
