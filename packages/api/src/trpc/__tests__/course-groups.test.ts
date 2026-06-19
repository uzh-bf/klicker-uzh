import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.FULL_ACCESS,
  catalystInstitutional: false,
  catalystIndividual: false,
}

function createContext(
  prisma: TRPCContext['prisma'],
  emitter?: TRPCContext['emitter']
): TRPCContext {
  return { prisma, user, emitter }
}

describe('course group routers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns course groups for readers', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      participantGroups: [
        {
          id: 'group-1',
          name: 'Blue Tigers',
          code: 123456,
          averageMemberScore: 7,
          groupActivityScore: 4,
          participants: [
            {
              id: 'participant-1',
              username: 'Participant 1',
              email: 'participant@example.com',
              avatar: 'avatar-1',
            },
          ],
        },
      ],
      groupAssignmentPoolEntries: [
        {
          id: 11,
          participant: {
            id: 'participant-2',
            username: 'Participant 2',
            email: null,
            avatar: null,
          },
        },
      ],
    })
    const findFirst = vi.fn().mockResolvedValue({ id: 1 })
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
      caller.course.groups({ courseId: 'course-1' })
    ).resolves.toEqual({
      courseGroups: {
        participantGroups: [
          {
            id: 'group-1',
            name: 'Blue Tigers',
            code: 123456,
            averageMemberScore: 7,
            groupActivityScore: 4,
            participants: [
              {
                id: 'participant-1',
                username: 'Participant 1',
                email: 'participant@example.com',
                avatar: 'avatar-1',
              },
            ],
          },
        ],
        groupAssignmentPoolEntries: [
          {
            id: 11,
            participant: {
              id: 'participant-2',
              username: 'Participant 2',
              email: null,
              avatar: null,
            },
          },
        ],
      },
    })
    expect(findFirst).toHaveBeenCalledWith({
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: expect.objectContaining({
        participantGroups: expect.any(Object),
        groupAssignmentPoolEntries: expect.any(Object),
      }),
    })
  })

  test('skips course group reads without permission', async () => {
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
      caller.course.groups({ courseId: 'course-1' })
    ).resolves.toEqual({
      courseGroups: null,
    })
    expect(findUnique).not.toHaveBeenCalled()
  })

  test('creates final random groups for writers', async () => {
    const courseUpdate = vi
      .fn()
      .mockResolvedValueOnce({
        groupAssignmentPoolEntries: [
          { id: 11, participantId: 'participant-1' },
          { id: 12, participantId: 'participant-2' },
          { id: 13, participantId: 'participant-3' },
          { id: 14, participantId: 'participant-4' },
        ],
      })
      .mockResolvedValueOnce({
        participantGroups: [
          {
            id: 'group-1',
            name: 'Generated Group',
            code: 123456,
            averageMemberScore: 0,
            groupActivityScore: 0,
            participants: [
              {
                id: 'participant-1',
                username: 'Participant 1',
                email: null,
                avatar: null,
              },
              {
                id: 'participant-2',
                username: 'Participant 2',
                email: null,
                avatar: null,
              },
            ],
          },
        ],
      })
    const emitter = {
      emit: vi.fn(),
    } as unknown as TRPCContext['emitter']
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          name: 'Course 1',
          preferredGroupSize: 2,
          groupAssignmentPoolEntries: [
            { id: 11, participantId: 'participant-1' },
            { id: 12, participantId: 'participant-2' },
            { id: 13, participantId: 'participant-3' },
            { id: 14, participantId: 'participant-4' },
          ],
          participantGroups: [],
        }),
        update: courseUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma, emitter))

    await expect(
      caller.course.manualRandomGroupAssignments({ courseId: 'course-1' })
    ).resolves.toEqual({
      participantGroups: [
        {
          id: 'group-1',
          name: 'Generated Group',
          code: 123456,
          averageMemberScore: 0,
          groupActivityScore: 0,
          participants: [
            {
              id: 'participant-1',
              username: 'Participant 1',
              email: null,
              avatar: null,
            },
            {
              id: 'participant-2',
              username: 'Participant 2',
              email: null,
              avatar: null,
            },
          ],
        },
      ],
    })
    expect(courseUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'course-1' },
      data: {
        groupAssignmentPoolEntries: {
          create: [],
        },
        participantGroups: {
          deleteMany: {
            id: {
              in: [],
            },
          },
        },
      },
      include: {
        groupAssignmentPoolEntries: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })
    expect(courseUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'course-1' },
      data: {
        groupDeadlineDate: expect.any(Date),
        randomAssignmentFinalized: true,
        participantGroups: {
          create: [
            expect.objectContaining({
              randomlyAssigned: true,
              name: expect.any(String),
              code: expect.any(Number),
              participants: {
                connect: [{ id: 'participant-1' }, { id: 'participant-2' }],
              },
            }),
            expect.objectContaining({
              randomlyAssigned: true,
              name: expect.any(String),
              code: expect.any(Number),
              participants: {
                connect: [{ id: 'participant-3' }, { id: 'participant-4' }],
              },
            }),
          ],
        },
        groupAssignmentPoolEntries: { deleteMany: {} },
      },
      select: expect.objectContaining({
        participantGroups: expect.any(Object),
      }),
    })
    expect(emitter?.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Course',
      id: 'course-1',
    })
    expect(emitter?.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'GroupAssignmentPoolEntry',
      id: 11,
    })
  })

  test('returns null for one-person random assignment pools', async () => {
    const courseUpdate = vi.fn().mockResolvedValueOnce({
      groupAssignmentPoolEntries: [{ id: 11, participantId: 'participant-1' }],
    })
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          name: 'Course 1',
          preferredGroupSize: 2,
          participantGroups: [],
        }),
        update: courseUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.course.manualRandomGroupAssignments({ courseId: 'course-1' })
    ).resolves.toEqual({ participantGroups: null })
    expect(courseUpdate).toHaveBeenCalledTimes(1)
  })
})
