import { LeaderboardType, UserRole } from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  emitter,
  prisma,
  role = UserRole.PARTICIPANT,
  sub = 'participant-1',
}: {
  emitter?: TRPCContext['emitter']
  prisma?: TRPCContext['prisma']
  role?: UserRole
  sub?: string
} = {}): TRPCContext {
  return {
    emitter,
    prisma,
    user: {
      sub,
      role,
    },
  }
}

describe('participant group routers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('creates a participant group when course group creation is enabled', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456)
    const emit = vi.fn()
    const create = vi.fn().mockResolvedValue({ id: 'group-1' })
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          isGroupCreationEnabled: true,
        }),
      },
      participantGroup: {
        create,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
      })
    )

    await expect(
      caller.participant.createParticipantGroup({
        courseId: 'course-1',
        name: '  Team Alpha  ',
      })
    ).resolves.toEqual({ id: 'group-1' })

    expect(prisma?.course.findUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: { id: true, isGroupCreationEnabled: true },
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Team Alpha',
        code: 211110,
        course: { connect: { id: 'course-1' } },
        participants: { connect: { id: 'participant-1' } },
      },
      select: { id: true },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'ParticipantGroup',
      id: 'group-1',
    })
  })

  test.each([
    {
      label: 'missing course',
      course: null,
      name: 'Team Alpha',
    },
    {
      label: 'disabled group creation',
      course: { id: 'course-1', isGroupCreationEnabled: false },
      name: 'Team Alpha',
    },
    {
      label: 'blank group name',
      course: { id: 'course-1', isGroupCreationEnabled: true },
      name: '   ',
    },
  ])('returns null for $label', async ({ course, name }) => {
    const create = vi.fn()
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(course),
      },
      participantGroup: {
        create,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.createParticipantGroup({
        courseId: 'course-1',
        name,
      })
    ).resolves.toBeNull()

    expect(create).not.toHaveBeenCalled()
  })

  test('joins a participant group by code and updates the average member score', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'group-1' })
    const prisma = {
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'group-1',
          averageMemberScore: 100,
          course: { maxGroupSize: 5 },
          participants: [{ id: 'participant-2' }, { id: 'participant-3' }],
        }),
        update,
      },
      leaderboardEntry: {
        findFirst: vi.fn().mockResolvedValue({ score: 250 }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.joinParticipantGroup({
        courseId: 'course-1',
        code: 123456,
      })
    ).resolves.toBe('group-1')

    expect(prisma?.participantGroup.findUnique).toHaveBeenCalledWith({
      where: {
        courseId_code: {
          courseId: 'course-1',
          code: 123456,
        },
      },
      select: {
        id: true,
        averageMemberScore: true,
        course: {
          select: { maxGroupSize: true },
        },
        participants: {
          select: { id: true },
        },
      },
    })
    expect(prisma?.leaderboardEntry.findFirst).toHaveBeenCalledWith({
      where: {
        participantId: 'participant-1',
        courseId: 'course-1',
        type: LeaderboardType.COURSE,
      },
      select: { score: true },
    })
    expect(update).toHaveBeenCalledWith({
      where: {
        courseId_code: {
          courseId: 'course-1',
          code: 123456,
        },
      },
      data: {
        participants: { connect: { id: 'participant-1' } },
        averageMemberScore: 150,
      },
      select: { id: true },
    })
  })

  test.each([
    {
      label: 'missing group',
      group: null,
      result: 'FAILURE',
    },
    {
      label: 'full group',
      group: {
        id: 'group-1',
        averageMemberScore: 100,
        course: { maxGroupSize: 2 },
        participants: [{ id: 'participant-2' }, { id: 'participant-3' }],
      },
      result: 'FULL',
    },
  ])('returns $result for $label', async ({ group, result }) => {
    const update = vi.fn()
    const findFirst = vi.fn()
    const prisma = {
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue(group),
        update,
      },
      leaderboardEntry: {
        findFirst,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.joinParticipantGroup({
        courseId: 'course-1',
        code: 123456,
      })
    ).resolves.toBe(result)

    expect(findFirst).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  test('joins the random course group pool', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 1 })
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          isGroupCreationEnabled: true,
        }),
      },
      groupAssignmentPoolEntry: {
        upsert,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.joinRandomCourseGroupPool({ courseId: 'course-1' })
    ).resolves.toBe(true)

    expect(upsert).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      create: {
        course: { connect: { id: 'course-1' } },
        participant: { connect: { id: 'participant-1' } },
      },
      update: {},
      select: { id: true },
    })
  })

  test('does not join the random course group pool when group creation is disabled', async () => {
    const upsert = vi.fn()
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          isGroupCreationEnabled: false,
        }),
      },
      groupAssignmentPoolEntry: {
        upsert,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.joinRandomCourseGroupPool({ courseId: 'course-1' })
    ).resolves.toBe(false)

    expect(upsert).not.toHaveBeenCalled()
  })

  test('leaves the random course group pool', async () => {
    const deletePoolEntry = vi.fn().mockResolvedValue({ id: 1 })
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          isGroupCreationEnabled: true,
          groupAssignmentPoolEntries: [{ id: 1 }],
        }),
      },
      groupAssignmentPoolEntry: {
        delete: deletePoolEntry,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.leaveRandomCourseGroupPool({ courseId: 'course-1' })
    ).resolves.toBe(true)

    expect(prisma?.course.findUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      select: {
        id: true,
        isGroupCreationEnabled: true,
        groupAssignmentPoolEntries: {
          where: { participantId: 'participant-1' },
          select: { id: true },
        },
      },
    })
    expect(deletePoolEntry).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
    })
  })

  test.each([
    {
      label: 'missing pool entry',
      course: {
        id: 'course-1',
        isGroupCreationEnabled: true,
        groupAssignmentPoolEntries: [],
      },
      rejectsDelete: false,
    },
    {
      label: 'delete failure',
      course: {
        id: 'course-1',
        isGroupCreationEnabled: true,
        groupAssignmentPoolEntries: [{ id: 1 }],
      },
      rejectsDelete: true,
    },
  ])(
    'returns false when leaving the random pool hits $label',
    async ({ course, rejectsDelete }) => {
      const deletePoolEntry = rejectsDelete
        ? vi.fn().mockRejectedValue(new Error('delete failed'))
        : vi.fn()
      const prisma = {
        course: {
          findUnique: vi.fn().mockResolvedValue(course),
        },
        groupAssignmentPoolEntry: {
          delete: deletePoolEntry,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(createContext({ prisma }))

      await expect(
        caller.participant.leaveRandomCourseGroupPool({ courseId: 'course-1' })
      ).resolves.toBe(false)
    }
  )

  test('leaves a singleton participant group by deleting it and emitting invalidation', async () => {
    const emit = vi.fn()
    const deleteGroup = vi.fn().mockResolvedValue({
      id: 'group-1',
      name: 'Team Alpha',
      code: 123456,
      participants: [{ id: 'participant-1', username: 'testuser1' }],
    })
    const prisma = {
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'group-1',
          participants: [{ id: 'participant-1', leaderboards: [] }],
        }),
        delete: deleteGroup,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
      })
    )

    await expect(
      caller.participant.leaveParticipantGroup({
        courseId: 'course-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({
      id: 'group-1',
      name: 'Team Alpha',
      code: 123456,
      participants: [{ id: 'participant-1', username: 'testuser1' }],
    })

    expect(prisma?.participantGroup.findUnique).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      select: {
        id: true,
        participants: {
          select: {
            id: true,
            leaderboards: {
              where: {
                courseId: 'course-1',
                type: LeaderboardType.COURSE,
              },
              select: { score: true },
            },
          },
        },
      },
    })
    expect(deleteGroup).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      select: {
        id: true,
        name: true,
        code: true,
        participants: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'ParticipantGroup',
      id: 'group-1',
    })
  })

  test('leaves a multi-member participant group and recomputes the average member score', async () => {
    const update = vi.fn().mockResolvedValue({
      id: 'group-1',
      name: 'Team Alpha',
      code: 123456,
      participants: [{ id: 'participant-2', username: 'testuser2' }],
    })
    const prisma = {
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'group-1',
          participants: [
            { id: 'participant-1', leaderboards: [{ score: 500 }] },
            { id: 'participant-2', leaderboards: [{ score: 200 }] },
            { id: 'participant-3', leaderboards: [{ score: 100 }] },
          ],
        }),
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.leaveParticipantGroup({
        courseId: 'course-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({
      id: 'group-1',
      name: 'Team Alpha',
      code: 123456,
      participants: [{ id: 'participant-2', username: 'testuser2' }],
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      data: {
        participants: {
          disconnect: { id: 'participant-1' },
        },
        averageMemberScore: 150,
      },
      select: {
        id: true,
        name: true,
        code: true,
        participants: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })
  })

  test('returns null when leaving a missing participant group', async () => {
    const update = vi.fn()
    const deleteGroup = vi.fn()
    const prisma = {
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue(null),
        update,
        delete: deleteGroup,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.leaveParticipantGroup({
        courseId: 'course-1',
        groupId: 'group-1',
      })
    ).resolves.toBeNull()

    expect(update).not.toHaveBeenCalled()
    expect(deleteGroup).not.toHaveBeenCalled()
  })

  test('renames a participant group with a trimmed name and emits invalidation', async () => {
    const emit = vi.fn()
    const update = vi.fn().mockResolvedValue({
      id: 'group-1',
      name: 'Team Beta',
    })
    const prisma = {
      participantGroup: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
      })
    )

    await expect(
      caller.participant.renameParticipantGroup({
        groupId: 'group-1',
        name: '  Team Beta  ',
      })
    ).resolves.toEqual({
      id: 'group-1',
      name: 'Team Beta',
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      data: { name: 'Team Beta' },
      select: {
        id: true,
        name: true,
      },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'ParticipantGroup',
      id: 'group-1',
    })
  })

  test('returns null when renaming a participant group to a blank name', async () => {
    const emit = vi.fn()
    const update = vi.fn()
    const prisma = {
      participantGroup: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
      })
    )

    await expect(
      caller.participant.renameParticipantGroup({
        groupId: 'group-1',
        name: '   ',
      })
    ).resolves.toBeNull()

    expect(update).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  test('adds a message to a participant group when the participant is a member', async () => {
    const createdAt = new Date('2026-06-03T10:00:00.000Z')
    const updatedAt = new Date('2026-06-03T10:01:00.000Z')
    const create = vi.fn().mockResolvedValue({
      id: 1,
      content: 'Hello team',
      createdAt,
      updatedAt,
      participant: {
        id: 'participant-1',
        username: 'testuser1',
        avatar: 'avatar-hash',
      },
    })
    const prisma = {
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          participants: [{ id: 'participant-1' }, { id: 'participant-2' }],
        }),
      },
      groupMessage: {
        create,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.addMessageToGroup({
        groupId: 'group-1',
        content: 'Hello team',
      })
    ).resolves.toEqual({
      id: 1,
      content: 'Hello team',
      createdAt,
      updatedAt,
      participant: {
        id: 'participant-1',
        username: 'testuser1',
        avatar: 'avatar-hash',
      },
    })

    expect(prisma?.participantGroup.findUnique).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      select: {
        participants: {
          select: { id: true },
        },
      },
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        content: 'Hello team',
        group: {
          connect: { id: 'group-1' },
        },
        participant: {
          connect: { id: 'participant-1' },
        },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        participant: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    })
  })

  test.each([
    {
      label: 'missing group',
      group: null,
    },
    {
      label: 'non-member participant',
      group: { participants: [{ id: 'participant-2' }] },
    },
  ])('returns null when adding a message hits $label', async ({ group }) => {
    const create = vi.fn()
    const prisma = {
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue(group),
      },
      groupMessage: {
        create,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.addMessageToGroup({
        groupId: 'group-1',
        content: 'Hello team',
      })
    ).resolves.toBeNull()

    expect(create).not.toHaveBeenCalled()
  })

  test('rejects group mutations for non-participants', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.createParticipantGroup({
        courseId: 'course-1',
        name: 'Team Alpha',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.joinParticipantGroup({
        courseId: 'course-1',
        code: 123456,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.joinRandomCourseGroupPool({ courseId: 'course-1' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.leaveRandomCourseGroupPool({ courseId: 'course-1' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.leaveParticipantGroup({
        courseId: 'course-1',
        groupId: 'group-1',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.renameParticipantGroup({
        groupId: 'group-1',
        name: 'Team Beta',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.addMessageToGroup({
        groupId: 'group-1',
        content: 'Hello team',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
