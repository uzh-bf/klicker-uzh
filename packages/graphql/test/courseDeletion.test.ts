import { PublicationStatus } from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const permissionMocks = vi.hoisted(() => ({
  propagateActivityToElements: vi.fn(),
  recomputeDerivedPermissions: vi.fn(),
}))

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const original = await importOriginal<typeof import('@klicker-uzh/util')>()

  return { ...original, ...permissionMocks }
})

import { deleteCourse, getCourseSummary } from '../src/services/courses.js'

function createContext() {
  const liveQuizzes = [
    {
      id: 'draft-live-quiz',
      isDeleted: false,
      status: PublicationStatus.DRAFT,
      blocks: [{ id: 1, elements: [] }],
    },
    {
      id: 'scheduled-live-quiz',
      isDeleted: false,
      status: PublicationStatus.SCHEDULED,
      blocks: [{ id: 2, elements: [] }],
    },
    {
      id: 'published-live-quiz',
      isDeleted: false,
      status: PublicationStatus.PUBLISHED,
      blocks: [{ id: 3, elements: [] }],
    },
  ]
  const course = {
    id: 'course-id',
    liveQuizzes,
    practiceQuizzes: [],
    microLearnings: [],
    groupActivities: [],
  }
  const transactionClient = {
    course: {
      delete: vi.fn().mockResolvedValue({ id: course.id }),
    },
    liveQuiz: {
      delete: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(liveQuizzes.find((quiz) => quiz.id === where.id))
        ),
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
  const ctx = {
    prisma,
    emitter,
    hatchet: { scheduled: { delete: vi.fn() } },
  } as unknown as ContextWithUser

  return { ctx, emitter, transactionClient }
}

describe('deleteCourse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('disconnects all linked live quizzes by default', async () => {
    const { ctx, emitter, transactionClient } = createContext()

    await deleteCourse({ id: 'course-id' }, ctx)

    expect(transactionClient.liveQuiz.delete).not.toHaveBeenCalled()
    expect(permissionMocks.propagateActivityToElements).not.toHaveBeenCalled()
    expect(permissionMocks.recomputeDerivedPermissions).toHaveBeenCalledTimes(3)
    expect(permissionMocks.recomputeDerivedPermissions).toHaveBeenCalledWith(
      { liveQuizId: 'draft-live-quiz' },
      transactionClient
    )
    expect(permissionMocks.recomputeDerivedPermissions).toHaveBeenCalledWith(
      { liveQuizId: 'scheduled-live-quiz' },
      transactionClient
    )
    expect(permissionMocks.recomputeDerivedPermissions).toHaveBeenCalledWith(
      { liveQuizId: 'published-live-quiz' },
      transactionClient
    )
    expect(transactionClient.course.delete).toHaveBeenCalledWith({
      where: { id: 'course-id' },
    })
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Course',
      id: 'course-id',
    })
  })

  it('deletes only linked draft live quizzes when requested', async () => {
    const { ctx, emitter, transactionClient } = createContext()

    await deleteCourse({ id: 'course-id', deleteDraftActivities: true }, ctx)

    expect(transactionClient.liveQuiz.delete).toHaveBeenCalledOnce()
    expect(transactionClient.liveQuiz.delete).toHaveBeenCalledWith({
      where: {
        id: 'draft-live-quiz',
        courseId: 'course-id',
        isDeleted: false,
        status: { in: [PublicationStatus.DRAFT] },
      },
    })
    expect(permissionMocks.propagateActivityToElements).toHaveBeenCalledWith(
      {
        stacks: [{ id: 1, elements: [] }],
        updateAccessRequests: true,
      },
      transactionClient
    )
    expect(permissionMocks.recomputeDerivedPermissions).toHaveBeenCalledTimes(2)
    expect(
      permissionMocks.recomputeDerivedPermissions
    ).not.toHaveBeenCalledWith(
      { liveQuizId: 'draft-live-quiz' },
      transactionClient
    )
    expect(permissionMocks.recomputeDerivedPermissions).toHaveBeenCalledWith(
      { liveQuizId: 'scheduled-live-quiz' },
      transactionClient
    )
    expect(permissionMocks.recomputeDerivedPermissions).toHaveBeenCalledWith(
      { liveQuizId: 'published-live-quiz' },
      transactionClient
    )
    expect(emitter.emit).toHaveBeenNthCalledWith(1, 'invalidate', {
      typename: 'LiveQuiz',
      id: 'draft-live-quiz',
    })
    expect(emitter.emit).toHaveBeenNthCalledWith(2, 'invalidate', {
      typename: 'Course',
      id: 'course-id',
    })
  })
})

describe('getCourseSummary', () => {
  it('exposes the number of linked draft live quizzes', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      liveQuizzes: [{ id: 'draft-live-quiz' }],
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
      numOfPracticeQuizzes: 4,
      numOfMicroLearnings: 5,
      numOfGroupActivities: 6,
      numOfLeaderboardEntries: 7,
      numOfParticipantGroups: 8,
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'course-id' },
      include: {
        liveQuizzes: {
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
