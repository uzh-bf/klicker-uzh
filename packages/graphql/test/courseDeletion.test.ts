import { PublicationStatus } from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const permissionMocks = vi.hoisted(() => ({
  propagateActivityToElements: vi.fn(),
  recomputeDerivedPermissions: vi.fn(),
}))
const serviceMocks = vi.hoisted(() => ({ checkAccess: vi.fn() }))

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const original = await importOriginal<typeof import('@klicker-uzh/util')>()

  return { ...original, ...permissionMocks }
})

vi.mock('../src/services/sharing.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/services/sharing.js')>()
  return { ...original, checkAccess: serviceMocks.checkAccess }
})

import {
  deleteCourse,
  getActiveUserCourses,
  getCourseSummary,
} from '../src/services/courses.js'

function stack(id: number, elementId: number) {
  return { id, elements: [{ elementId }] }
}

function createContext() {
  const liveQuizzes = [
    {
      id: 'draft-live-quiz',
      isDeleted: false,
      status: PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
      blocks: [{ id: 1, elements: [] }],
    },
    {
      id: 'published-live-quiz',
      isDeleted: false,
      status: PublicationStatus.PUBLISHED,
      scheduledPublicationTaskId: null,
      blocks: [{ id: 2, elements: [] }],
    },
  ]
  const practiceQuizzes = [
    {
      id: 'draft-practice-quiz',
      isDeleted: false,
      status: PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
      stacks: [stack(3, 101)],
    },
    {
      id: 'published-practice-quiz',
      isDeleted: false,
      status: PublicationStatus.PUBLISHED,
      scheduledPublicationTaskId: null,
      stacks: [stack(4, 201)],
    },
  ]
  const microLearnings = [
    {
      id: 'draft-micro-learning',
      isDeleted: false,
      status: PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
      stacks: [stack(5, 102)],
    },
    {
      id: 'published-micro-learning',
      isDeleted: false,
      status: PublicationStatus.PUBLISHED,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
      stacks: [stack(6, 202)],
    },
  ]
  const groupActivities = [
    {
      id: 'draft-group-activity',
      isDeleted: false,
      status: PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
      stacks: [stack(7, 103), stack(8, 101)],
    },
    {
      id: 'published-group-activity',
      isDeleted: false,
      status: PublicationStatus.PUBLISHED,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
      stacks: [stack(9, 203)],
    },
  ]
  const course = {
    id: 'course-id',
    deletionJobId: 'job-id',
    isDeleted: false,
    isDeletionPending: true,
    isAssessmentEnabled: false,
    liveQuizzes,
    practiceQuizzes,
    microLearnings,
    groupActivities,
  }
  const transactionClient = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
    liveQuizResponseAdmission: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    course: {
      findUnique: vi.fn().mockResolvedValue(course),
      update: vi.fn().mockResolvedValue({ ...course, isDeleted: true }),
    },
    liveQuiz: {
      delete: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(liveQuizzes.find((quiz) => quiz.id === where.id))
        ),
      findMany: vi
        .fn()
        .mockResolvedValue(
          liveQuizzes.filter((quiz) => quiz.status === PublicationStatus.DRAFT)
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    practiceQuiz: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi
        .fn()
        .mockResolvedValue(
          practiceQuizzes.filter(
            (quiz) => quiz.status === PublicationStatus.DRAFT
          )
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    microLearning: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi
        .fn()
        .mockResolvedValue(
          microLearnings.filter(
            (activity) => activity.status === PublicationStatus.DRAFT
          )
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    groupActivity: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi
        .fn()
        .mockResolvedValue(
          groupActivities.filter(
            (activity) => activity.status === PublicationStatus.DRAFT
          )
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  }
  const prisma = {
    course: {
      findUnique: vi.fn().mockResolvedValue(course),
    },
    $transaction: vi.fn(
      async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient)
    ),
  }
  const emitter = { emit: vi.fn() }
  const responseFenceSet = vi.fn()
  const responseFenceExec = vi
    .fn()
    .mockResolvedValue(liveQuizzes.map(() => [null, 'OK']))
  const responseFence = {
    set: responseFenceSet,
    exec: responseFenceExec,
  }
  responseFenceSet.mockReturnValue(responseFence)
  const ctx = {
    prisma,
    emitter,
    redisExec: { pipeline: vi.fn().mockReturnValue(responseFence) },
    hatchet: { scheduled: { delete: vi.fn() } },
  } as unknown as ContextWithUser

  return {
    ctx,
    emitter,
    prisma,
    responseFenceExec,
    responseFenceSet,
    transactionClient,
  }
}

describe('deleteCourse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes the course and retains all linked data by default', async () => {
    const {
      ctx,
      emitter,
      prisma,
      responseFenceExec,
      responseFenceSet,
      transactionClient,
    } = createContext()

    await deleteCourse({ deletionJobId: 'job-id', id: 'course-id' }, ctx)

    expect(transactionClient.liveQuiz.delete).not.toHaveBeenCalled()
    expect(transactionClient.liveQuiz.findMany).not.toHaveBeenCalled()
    expect(transactionClient.practiceQuiz.findMany).not.toHaveBeenCalled()
    expect(transactionClient.microLearning.findMany).not.toHaveBeenCalled()
    expect(transactionClient.groupActivity.findMany).not.toHaveBeenCalled()
    expect(permissionMocks.propagateActivityToElements).not.toHaveBeenCalled()
    expect(permissionMocks.recomputeDerivedPermissions).not.toHaveBeenCalled()
    expect(responseFenceSet).toHaveBeenCalledWith(
      'lq:draft-live-quiz:course-deleted',
      '1'
    )
    expect(responseFenceSet).toHaveBeenCalledWith(
      'lq:published-live-quiz:course-deleted',
      '1'
    )
    expect(responseFenceExec).toHaveBeenCalledOnce()
    expect(
      transactionClient.liveQuizResponseAdmission.findFirst
    ).toHaveBeenCalledWith({
      where: { courseId: 'course-id', failedAt: null },
      select: { token: true },
    })
    expect(
      transactionClient.liveQuizResponseAdmission.deleteMany
    ).toHaveBeenCalledWith({
      where: { courseId: 'course-id', failedAt: { not: null } },
    })
    expect(transactionClient.$queryRaw).toHaveBeenCalledOnce()
    expect(
      transactionClient.$queryRaw.mock.invocationCallOrder[0] ?? 0
    ).toBeLessThan(
      transactionClient.course.update.mock.invocationCallOrder[0] ?? 0
    )
    expect(transactionClient.course.update).toHaveBeenCalledWith({
      where: {
        id: 'course-id',
        deletionJobId: 'job-id',
        isAssessmentEnabled: false,
        isDeleted: false,
        isDeletionPending: true,
      },
      data: {
        deletionJobId: null,
        deletionRequestedById: null,
        deletionPendingAt: null,
        deleteDraftActivitiesOnDeletion: false,
        isDeleted: true,
        isDeletionPending: false,
      },
    })
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Course',
      id: 'course-id',
    })
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 10 * 60 * 1000,
    })
  })

  it('permanently deletes only linked draft activities when requested', async () => {
    const { ctx, emitter, transactionClient } = createContext()

    await deleteCourse(
      {
        deletionJobId: 'job-id',
        id: 'course-id',
        deleteDraftActivities: true,
      },
      ctx
    )

    expect(transactionClient.liveQuiz.delete).toHaveBeenCalledOnce()
    expect(transactionClient.liveQuiz.delete).toHaveBeenCalledWith({
      where: {
        id: 'draft-live-quiz',
        courseId: 'course-id',
        isDeleted: false,
        status: { in: [PublicationStatus.DRAFT] },
      },
    })
    expect(transactionClient.practiceQuiz.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['draft-practice-quiz'] },
        courseId: 'course-id',
        isDeleted: false,
        status: PublicationStatus.DRAFT,
      },
    })
    expect(transactionClient.microLearning.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['draft-micro-learning'] },
        courseId: 'course-id',
        isDeleted: false,
        status: PublicationStatus.DRAFT,
      },
    })
    expect(transactionClient.groupActivity.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['draft-group-activity'] },
        courseId: 'course-id',
        isDeleted: false,
        status: PublicationStatus.DRAFT,
      },
    })
    expect(permissionMocks.propagateActivityToElements).toHaveBeenCalledTimes(2)
    expect(permissionMocks.propagateActivityToElements).toHaveBeenCalledWith(
      {
        stacks: [{ id: 1, elements: [] }],
        updateAccessRequests: true,
      },
      transactionClient
    )
    expect(permissionMocks.propagateActivityToElements).toHaveBeenCalledWith(
      {
        stacks: [stack(3, 101), stack(5, 102), stack(7, 103), stack(8, 101)],
        updateAccessRequests: true,
      },
      transactionClient
    )
    expect(permissionMocks.recomputeDerivedPermissions).not.toHaveBeenCalled()
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'draft-live-quiz',
    })
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'PracticeQuiz',
      id: 'draft-practice-quiz',
    })
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'MicroLearning',
      id: 'draft-micro-learning',
    })
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'GroupActivity',
      id: 'draft-group-activity',
    })
  })

  it('treats an already soft-deleted course as an idempotent retry', async () => {
    const { ctx, transactionClient } = createContext()
    transactionClient.course.findUnique.mockResolvedValueOnce({
      id: 'course-id',
      isDeleted: true,
      isAssessmentEnabled: false,
      liveQuizzes: [],
      practiceQuizzes: [],
      microLearnings: [],
      groupActivities: [],
    })

    await expect(
      deleteCourse({ deletionJobId: 'job-id', id: 'course-id' }, ctx)
    ).resolves.toMatchObject({
      id: 'course-id',
      isDeleted: true,
    })

    expect(transactionClient.course.update).not.toHaveBeenCalled()
    expect(transactionClient.liveQuiz.updateMany).not.toHaveBeenCalled()
    expect(permissionMocks.recomputeDerivedPermissions).not.toHaveBeenCalled()
  })

  it('does not run post-commit cleanup when the transaction fails', async () => {
    const { ctx, emitter, responseFenceExec, transactionClient } =
      createContext()
    transactionClient.course.update.mockRejectedValueOnce(
      new Error('transaction rolled back')
    )

    await expect(
      deleteCourse({ deletionJobId: 'job-id', id: 'course-id' }, ctx)
    ).rejects.toThrow('transaction rolled back')
    expect(ctx.hatchet.scheduled.delete).not.toHaveBeenCalled()
    expect(responseFenceExec).not.toHaveBeenCalled()
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('does not soft-delete while an accepted response handoff is pending', async () => {
    const { ctx, responseFenceExec, transactionClient } = createContext()
    transactionClient.liveQuizResponseAdmission.findFirst.mockResolvedValueOnce(
      { token: 'response-token' }
    )

    await expect(
      deleteCourse({ deletionJobId: 'job-id', id: 'course-id' }, ctx)
    ).rejects.toMatchObject({
      extensions: {
        code: 'COURSE_DELETION_RESPONSE_ADMISSION_PENDING',
      },
    })
    expect(transactionClient.course.update).not.toHaveBeenCalled()
    expect(responseFenceExec).not.toHaveBeenCalled()
  })
})

describe('getCourseSummary', () => {
  it('exposes the number of linked draft activities across all types', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      liveQuizzes: [{ id: 'draft-live-quiz' }],
      practiceQuizzes: [{ id: 'draft-practice-quiz' }],
      microLearnings: [{ id: 'draft-micro-learning' }],
      groupActivities: [{ id: 'draft-group-activity' }],
      _count: {
        participations: 2,
        liveQuizzes: 3,
        practiceQuizzes: 4,
        microLearnings: 5,
        groupActivities: 6,
        leaderboard: 7,
        participantGroups: 8,
      },
    })
    const ctx = {
      prisma: { course: { findUnique } },
    } as unknown as ContextWithUser

    await expect(
      getCourseSummary({ courseId: 'course-id' }, ctx)
    ).resolves.toEqual({
      numOfParticipations: 2,
      numOfLiveQuizzes: 3,
      numOfDraftLiveQuizzes: 1,
      numOfDraftActivities: 4,
      numOfPracticeQuizzes: 4,
      numOfMicroLearnings: 5,
      numOfGroupActivities: 6,
      numOfLeaderboardEntries: 7,
      numOfParticipantGroups: 8,
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'course-id',
        isDeleted: false,
        isDeletionPending: false,
      },
      include: {
        liveQuizzes: {
          where: {
            isDeleted: false,
            status: PublicationStatus.DRAFT,
          },
          select: { id: true },
        },
        practiceQuizzes: {
          where: {
            isDeleted: false,
            status: PublicationStatus.DRAFT,
          },
          select: { id: true },
        },
        microLearnings: {
          where: {
            isDeleted: false,
            status: PublicationStatus.DRAFT,
          },
          select: { id: true },
        },
        groupActivities: {
          where: {
            isDeleted: false,
            status: PublicationStatus.DRAFT,
          },
          select: { id: true },
        },
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
})

describe('getActiveUserCourses', () => {
  it.each([
    { isDeleted: false, isDeletionPending: true },
    { isDeleted: true, isDeletionPending: false },
  ])('does not reinsert an activity course hidden by deletion state', async (deletionState) => {
    serviceMocks.checkAccess.mockResolvedValueOnce(true)
    const activityCourse = {
      id: 'hidden-course',
      createdAt: new Date(),
      ...deletionState,
    }
    const ctx = {
      user: { sub: 'user-id' },
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ objects: [] }) },
        liveQuiz: {
          findUnique: vi.fn().mockResolvedValue({ course: activityCourse }),
        },
      },
    } as unknown as ContextWithUser

    await expect(
      getActiveUserCourses(
        { activityId: 'quiz-id', activityType: ActivityType.LIVE_QUIZ },
        ctx
      )
    ).resolves.toEqual([])
  })
})
