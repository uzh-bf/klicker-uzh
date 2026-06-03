import {
  AccessMode,
  LeaderboardType,
  PermissionLevel,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
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

describe('participant join routers', () => {
  test('returns public live quizzes for a lecturer shortname', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          liveQuiz: {
            id: 'live-quiz-1',
            name: 'live-quiz-one',
            displayName: 'Live Quiz One',
            isGamificationEnabled: true,
            isAssessmentEnabled: false,
            pinCode: '123456',
            course: {
              id: 'course-1',
              displayName: 'Course One',
            },
          },
        },
        {
          liveQuiz: {
            id: 'live-quiz-2',
            name: 'live-quiz-two',
            displayName: 'Live Quiz Two',
            isGamificationEnabled: false,
            isAssessmentEnabled: true,
            pinCode: null,
            course: null,
          },
        },
      ],
    })
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.participant.shortnameQuizzes({ shortname: ' lecturer ' })
    ).resolves.toEqual({
      shortnameQuizzes: [
        {
          id: 'live-quiz-1',
          name: 'live-quiz-one',
          displayName: 'Live Quiz One',
          isGamificationEnabled: true,
          isAssessmentEnabled: false,
          isPinProtected: true,
          course: {
            id: 'course-1',
            displayName: 'Course One',
          },
        },
        {
          id: 'live-quiz-2',
          name: 'live-quiz-two',
          displayName: 'Live Quiz Two',
          isGamificationEnabled: false,
          isAssessmentEnabled: true,
          isPinProtected: false,
          course: null,
        },
      ],
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { shortname: 'lecturer' },
      select: {
        objects: {
          where: {
            liveQuizId: { not: null },
            liveQuiz: {
              status: PublicationStatus.PUBLISHED,
              accessMode: AccessMode.PUBLIC,
            },
            permissionLevel: {
              in: [
                PermissionLevel.OWNER,
                PermissionLevel.ADMIN,
                PermissionLevel.WRITE,
                PermissionLevel.EXECUTE,
              ],
            },
          },
          select: {
            liveQuiz: {
              select: {
                id: true,
                name: true,
                displayName: true,
                isGamificationEnabled: true,
                isAssessmentEnabled: true,
                pinCode: true,
                course: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  test('returns an empty shortname quiz list for missing lecturers', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({ prisma })

    await expect(
      caller.participant.shortnameQuizzes({ shortname: 'unknown' })
    ).resolves.toEqual({ shortnameQuizzes: [] })
  })

  test('checks whether a course PIN resolves to a course id', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'course-1',
      pinCode: 123456789,
    })
    const prisma = {
      course: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.checkValidCoursePin({ pin: 123456789 })
    ).resolves.toBe('course-1')

    expect(findUnique).toHaveBeenCalledWith({
      where: { pinCode: 123456789 },
      select: { id: true, pinCode: true },
    })
  })

  test('returns null when a course PIN is not valid', async () => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.checkValidCoursePin({ pin: 987654321 })
    ).resolves.toBeNull()
  })

  test('joins a participant to a course with a valid PIN', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'participant-1' })
    const emit = vi.fn()
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-1',
          isAssessmentEnabled: false,
          pinCode: 123456789,
        }),
      },
      participant: {
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
      caller.participant.joinCourseWithPin({ pin: 123456789 })
    ).resolves.toEqual({ id: 'participant-1' })

    expect(prisma?.course.findUnique).toHaveBeenCalledWith({
      where: { pinCode: 123456789, isAssessmentEnabled: false },
      select: { id: true, isAssessmentEnabled: true, pinCode: true },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: {
        participations: {
          connectOrCreate: {
            where: {
              courseId_participantId: {
                courseId: 'course-1',
                participantId: 'participant-1',
              },
            },
            create: { course: { connect: { id: 'course-1' } } },
          },
        },
      },
      select: { id: true },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Participant',
      id: 'participant-1',
    })
  })

  test.each([
    {
      label: 'missing course',
      course: null,
    },
    {
      label: 'assessment course',
      course: {
        id: 'assessment-course',
        isAssessmentEnabled: true,
        pinCode: 123456789,
      },
    },
  ])('returns null when joining with $label', async ({ course }) => {
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue(course),
      },
      participant: {
        update: vi.fn(),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.joinCourseWithPin({ pin: 123456789 })
    ).resolves.toBeNull()

    expect(prisma?.participant.update).not.toHaveBeenCalled()
  })

  test('joins a participant to the course leaderboard', async () => {
    const emit = vi.fn()
    const participationUpsert = vi.fn().mockResolvedValue({
      id: 3,
      isActive: true,
    })
    const leaderboardUpsert = vi.fn().mockResolvedValue({ id: 7 })
    const prisma = {
      participation: {
        upsert: participationUpsert,
      },
      leaderboardEntry: {
        upsert: leaderboardUpsert,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
      })
    )

    await expect(
      caller.participant.joinCourseLeaderboard({ courseId: 'course-1' })
    ).resolves.toEqual({
      learningData: {
        id: 'course-1-participant-1',
        participation: {
          id: 3,
          isActive: true,
        },
      },
    })

    expect(participationUpsert).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      create: {
        isActive: true,
        course: { connect: { id: 'course-1' } },
        participant: { connect: { id: 'participant-1' } },
      },
      update: { isActive: true },
      select: {
        id: true,
        isActive: true,
      },
    })
    expect(leaderboardUpsert).toHaveBeenCalledWith({
      where: {
        type_participantId_courseId: {
          type: LeaderboardType.COURSE,
          participantId: 'participant-1',
          courseId: 'course-1',
        },
      },
      create: {
        type: LeaderboardType.COURSE,
        participant: { connect: { id: 'participant-1' } },
        course: { connect: { id: 'course-1' } },
        participation: { connect: { id: 3 } },
        score: 0,
      },
      update: {},
      select: { id: true },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Participation',
      id: 3,
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LeaderboardEntry',
      id: 7,
    })
  })

  test('leaves a participant from the course leaderboard', async () => {
    const update = vi.fn().mockResolvedValue({
      id: 3,
      isActive: false,
    })
    const deleteLeaderboardEntry = vi.fn().mockResolvedValue({ id: 7 })
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 })
    const updateMany = vi.fn().mockResolvedValue({ count: 4 })
    const prisma = {
      participation: {
        update,
      },
      leaderboardEntry: {
        delete: deleteLeaderboardEntry,
        deleteMany,
      },
      timelineEntry: {
        updateMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.leaveCourseLeaderboard({ courseId: 'course-1' })
    ).resolves.toEqual({
      leaveCourseParticipation: {
        id: 'course-1-participant-1',
        participation: {
          id: 3,
          isActive: false,
        },
      },
    })

    expect(update).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
      data: {
        isActive: false,
      },
      select: {
        id: true,
        isActive: true,
      },
    })
    expect(deleteLeaderboardEntry).toHaveBeenCalledWith({
      where: {
        type_participantId_courseId: {
          type: LeaderboardType.COURSE,
          participantId: 'participant-1',
          courseId: 'course-1',
        },
      },
    })
    expect(deleteMany).toHaveBeenCalledWith({
      where: { participation: { id: 3 } },
    })
    expect(deleteMany).toHaveBeenCalledWith({
      where: { sessionParticipationId: 3 },
    })
    expect(updateMany).toHaveBeenCalledWith({
      where: { participationId: 3 },
      data: {
        collectedPoints: 0,
      },
    })
  })

  test('rejects course joining for non-participants', async () => {
    const caller = appRouter.createCaller(
      createContext({ role: UserRole.USER, sub: 'user-1' })
    )

    await expect(
      caller.participant.joinCourseWithPin({ pin: 123456789 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.joinCourseLeaderboard({ courseId: 'course-1' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      caller.participant.leaveCourseLeaderboard({ courseId: 'course-1' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
