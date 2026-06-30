import {
  Locale,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'

const recomputeDerivedPermissions = vi.hoisted(() => vi.fn())

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()
  return {
    ...actual,
    recomputeDerivedPermissions,
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

describe('course mutation routers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('creates a course and recomputes owner permissions', async () => {
    const startDate = new Date('2026-09-01T00:00:00.000Z')
    const endDate = new Date('2027-02-01T00:00:00.000Z')
    const groupDeadlineDate = new Date('2026-10-01T00:00:00.000Z')
    const createdAt = new Date('2026-06-01T00:00:00.000Z')
    const updatedAt = new Date('2026-06-02T00:00:00.000Z')
    const courseCreate = vi.fn().mockResolvedValue({
      id: 'course-1',
      name: 'Course',
      displayName: 'Course Display',
      description: 'Description',
      color: '#0028A5',
      startDate,
      endDate,
      isArchived: false,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      isGroupCreationEnabled: true,
      createdAt,
      updatedAt,
    })
    const tx = {
      course: {
        create: courseCreate,
      },
    }
    const transaction = vi.fn(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx)
    )
    const prisma = {
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.create({
        name: ' Course ',
        displayName: ' Course Display ',
        description: 'Description',
        color: '#0028A5',
        startDate,
        endDate,
        isGroupCreationEnabled: true,
        groupDeadlineDate,
        maxGroupSize: 5,
        preferredGroupSize: 3,
        language: Locale.en,
        notificationEmail: 'lecturer@example.com',
        isGamificationEnabled: true,
      })
    ).resolves.toMatchObject({
      course: {
        id: 'course-1',
        name: 'Course',
        displayName: 'Course Display',
        permissionLevel: PermissionLevel.OWNER,
        isOwner: true,
        isManager: true,
        isEditor: true,
        isShared: false,
        isRemovable: false,
      },
    })
    expect(courseCreate).toHaveBeenCalledWith({
      data: {
        name: 'Course',
        displayName: 'Course Display',
        description: 'Description',
        language: Locale.en,
        color: '#0028A5',
        startDate,
        endDate,
        isGroupCreationEnabled: true,
        groupDeadlineDate,
        maxGroupSize: 5,
        preferredGroupSize: 3,
        notificationEmail: 'lecturer@example.com',
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        pinCode: expect.any(Number),
        owner: {
          connect: {
            id: user.sub,
          },
        },
      },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      {
        courseId: 'course-1',
        userId: user.sub,
      },
      tx
    )
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
    })
  })

  test('returns null when archive permission is missing', async () => {
    const update = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      course: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.toggleArchive({ id: 'course-1', isArchived: true })
    ).resolves.toEqual({ course: null })
    expect(update).not.toHaveBeenCalled()
  })

  test('archives courses for admins', async () => {
    const update = vi.fn().mockResolvedValue({
      id: 'course-1',
      isArchived: true,
    })
    const findFirst = vi.fn().mockResolvedValue({ id: 1 })
    const prisma = {
      derivedPermission: {
        findFirst,
      },
      course: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.toggleArchive({ id: 'course-1', isArchived: true })
    ).resolves.toEqual({
      course: {
        id: 'course-1',
        isArchived: true,
      },
    })
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        courseId: 'course-1',
        userId: user.sub,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'course-1', endDate: { lte: expect.any(Date) } },
      data: { isArchived: true },
      select: {
        id: true,
        isArchived: true,
      },
    })
  })

  test('returns null when delete permission is missing', async () => {
    const findUnique = vi.fn()
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      course: {
        findUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.course.delete({ id: 'course-1' })).resolves.toEqual({
      course: null,
    })
    expect(findUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  test('rejects course deletion when the course cannot be deleted', async () => {
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.course.delete({ id: 'course-1' })).rejects.toThrow(
      'Course not found or permission denied'
    )
    expect(transaction).not.toHaveBeenCalled()
  })

  test('deletes courses and cleans up derived side effects', async () => {
    const courseDelete = vi.fn().mockResolvedValue({ id: 'course-1' })
    const tx = {
      course: {
        delete: courseDelete,
      },
    }
    const transaction = vi.fn(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx)
    )
    const scheduledDelete = vi.fn().mockResolvedValue(undefined)
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          liveQuizzes: [{ id: 'live-quiz-1' }],
          practiceQuizzes: [
            {
              id: 'practice-quiz-1',
              scheduledPublicationTaskId: 'task-pq-publication',
              stacks: [
                {
                  elements: [{ elementId: 1 }, { elementId: 2 }],
                },
              ],
            },
          ],
          microLearnings: [
            {
              id: 'microlearning-1',
              scheduledPublicationTaskId: 'task-ml-publication',
              scheduledCompletionTaskId: 'task-ml-completion',
              stacks: [
                {
                  elements: [{ elementId: 2 }, { elementId: 3 }],
                },
              ],
            },
          ],
          groupActivities: [
            {
              id: 'group-activity-1',
              scheduledPublicationTaskId: null,
              scheduledCompletionTaskId: 'task-ga-completion',
              stacks: [
                {
                  elements: [{ elementId: 3 }, { elementId: 4 }],
                },
              ],
            },
          ],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      hatchet: {
        scheduled: {
          delete: scheduledDelete,
        },
      },
      emitter: {
        emit,
      } as unknown as TRPCContext['emitter'],
    })

    await expect(caller.course.delete({ id: 'course-1' })).resolves.toEqual({
      course: { id: 'course-1' },
    })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
    })
    expect(courseDelete).toHaveBeenCalledWith({ where: { id: 'course-1' } })
    expect(recomputeDerivedPermissions).toHaveBeenNthCalledWith(
      1,
      { liveQuizId: 'live-quiz-1' },
      tx
    )
    expect(recomputeDerivedPermissions).toHaveBeenNthCalledWith(
      2,
      { elementId: 1 },
      tx
    )
    expect(recomputeDerivedPermissions).toHaveBeenNthCalledWith(
      3,
      { elementId: 2 },
      tx
    )
    expect(recomputeDerivedPermissions).toHaveBeenNthCalledWith(
      4,
      { elementId: 3 },
      tx
    )
    expect(recomputeDerivedPermissions).toHaveBeenNthCalledWith(
      5,
      { elementId: 4 },
      tx
    )
    expect(scheduledDelete).toHaveBeenNthCalledWith(1, 'task-pq-publication')
    expect(scheduledDelete).toHaveBeenNthCalledWith(2, 'task-ml-publication')
    expect(scheduledDelete).toHaveBeenNthCalledWith(3, 'task-ml-completion')
    expect(scheduledDelete).toHaveBeenNthCalledWith(4, 'task-ga-completion')
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Course',
      id: 'course-1',
    })
  })

  test('returns null when course settings update permission is missing', async () => {
    const findUnique = vi.fn()
    const update = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      course: {
        findUnique,
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.updateSettings({ id: 'course-1', language: Locale.en })
    ).resolves.toEqual({ course: null })
    expect(findUnique).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  test('returns null when course settings target is missing', async () => {
    const update = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.updateSettings({ id: 'course-1', language: Locale.en })
    ).resolves.toEqual({ course: null })
    expect(update).not.toHaveBeenCalled()
  })

  test('updates course settings with guarded side effects', async () => {
    const startDate = new Date('2099-09-01T00:00:00.000Z')
    const endDate = new Date('2100-02-01T00:00:00.000Z')
    const groupDeadlineDate = new Date('2099-10-01T00:00:00.000Z')
    const updatedAt = new Date('2026-06-02T00:00:00.000Z')
    const createdAt = new Date('2026-06-01T00:00:00.000Z')
    const updatedCourse = {
      id: 'course-1',
      name: 'Updated Course',
      displayName: 'Updated Course Display',
      description: null,
      color: '#0028A5',
      startDate,
      endDate,
      groupDeadlineDate,
      maxGroupSize: 5,
      preferredGroupSize: 3,
      language: Locale.de,
      notificationEmail: 'lecturer@example.com',
      isArchived: false,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      isGroupCreationEnabled: false,
      randomAssignmentFinalized: false,
      createdAt,
      updatedAt,
    }
    const update = vi.fn().mockResolvedValue(updatedCourse)
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          startDate,
          isGamificationEnabled: false,
          isAssessmentEnabled: false,
          _count: {
            liveQuizzes: 0,
            practiceQuizzes: 0,
            microLearnings: 0,
            groupActivities: 0,
            participantGroups: 0,
          },
        }),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.updateSettings({
        id: 'course-1',
        name: 'Updated Course',
        displayName: 'Updated Course Display',
        description: null,
        color: '#0028A5',
        startDate,
        endDate,
        isGroupCreationEnabled: false,
        groupDeadlineDate,
        language: Locale.de,
        notificationEmail: 'lecturer@example.com',
        isGamificationEnabled: true,
      })
    ).resolves.toEqual({ course: updatedCourse })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: expect.objectContaining({
        name: 'Updated Course',
        displayName: 'Updated Course Display',
        description: null,
        language: Locale.de,
        color: '#0028A5',
        startDate,
        endDate,
        isGroupCreationEnabled: false,
        groupDeadlineDate,
        notificationEmail: 'lecturer@example.com',
        isGamificationEnabled: true,
        isAssessmentEnabled: undefined,
        pinCode: undefined,
        randomAssignmentFinalized: false,
        groupAssignmentPoolEntries: { deleteMany: {} },
        liveQuizzes: {
          updateMany: {
            where: {
              isDeleted: false,
              status: {
                in: [
                  PublicationStatus.DRAFT,
                  PublicationStatus.SCHEDULED,
                  PublicationStatus.PUBLISHED,
                ],
              },
            },
            data: {
              isGamificationEnabled: true,
              isAssessmentEnabled: undefined,
            },
          },
        },
        practiceQuizzes: expect.any(Object),
        microLearnings: expect.any(Object),
        groupActivities: expect.any(Object),
      }),
      select: expect.objectContaining({
        id: true,
        name: true,
        displayName: true,
        randomAssignmentFinalized: true,
      }),
    })
  })
})
