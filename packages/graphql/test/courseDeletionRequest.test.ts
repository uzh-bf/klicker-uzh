import { PermissionLevel, PublicationStatus } from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const permanentDeletion = vi.hoisted(() => vi.fn())

vi.mock('../src/services/courses.js', () => ({
  deleteCourse: permanentDeletion,
}))

import {
  handleProcessCourseDeletion,
  handleSweepCourseDeletions,
  requestCourseDeletion,
} from '../src/services/courseDeletion.js'

function executionContext() {
  return { logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } } as any
}

describe('course deletion requests', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists the request before publishing its Hatchet event', async () => {
    const course = {
      id: 'course-id',
      deletionRequestedAt: null,
      liveQuizzes: [],
    }
    const transactionClient = {
      course: {
        findUnique: vi.fn().mockResolvedValue(course),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }
    const hatchet = { events: { push: vi.fn() } }
    const ctx = {
      prisma: {
        $transaction: vi.fn((callback: (client: any) => unknown) =>
          callback(transactionClient)
        ),
      },
      hatchet,
      user: { sub: 'requester-id' },
    } as any

    const request = await requestCourseDeletion(
      { id: course.id, deleteDraftActivities: true },
      ctx
    )

    expect(transactionClient.course.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: course.id, deletionRequestedAt: null },
        data: expect.objectContaining({
          deletionRequestedById: 'requester-id',
          deleteDraftActivitiesOnDeletion: true,
        }),
      })
    )
    expect(hatchet.events.push).toHaveBeenCalledWith(
      'process-course-deletion',
      expect.objectContaining({
        courseId: course.id,
        deletionRequestedAt: expect.any(String),
      })
    )
    expect(request.courseId).toBe(course.id)
  })

  it('rejects a course with a published live quiz', async () => {
    const transactionClient = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-id',
          deletionRequestedAt: null,
          liveQuizzes: [{ id: 'live-quiz-id' }],
        }),
        updateMany: vi.fn(),
      },
    }
    const ctx = {
      prisma: {
        $transaction: vi.fn((callback: (client: any) => unknown) =>
          callback(transactionClient)
        ),
      },
      hatchet: { events: { push: vi.fn() } },
      user: { sub: 'requester-id' },
    } as any

    await expect(
      requestCourseDeletion({ id: 'course-id' }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'COURSE_DELETION_ACTIVE_LIVE_QUIZ' },
    })
    expect(transactionClient.course.updateMany).not.toHaveBeenCalled()
  })
})

describe('course deletion worker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('permanently deletes a current request after rechecking access', async () => {
    const requestedAt = new Date('2026-01-01T00:00:00.000Z')
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-id',
          deletionRequestedAt: requestedAt,
          deletionRequestedById: 'requester-id',
          deleteDraftActivitiesOnDeletion: true,
          liveQuizzes: [],
        }),
      },
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.ADMIN,
        }),
      },
    }
    const globalContext = { prisma, emitter: { emit: vi.fn() } } as any

    await handleProcessCourseDeletion(
      {
        courseId: 'course-id',
        deletionRequestedAt: requestedAt.toISOString(),
      },
      globalContext,
      executionContext()
    )

    expect(permanentDeletion).toHaveBeenCalledWith(
      {
        id: 'course-id',
        deleteDraftActivities: true,
        deletionRequestedAt: requestedAt,
      },
      globalContext
    )
  })

  it('clears a request when a published live quiz appears', async () => {
    const requestedAt = new Date('2026-01-01T00:00:00.000Z')
    const prisma = {
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-id',
          deletionRequestedAt: requestedAt,
          deletionRequestedById: 'requester-id',
          deleteDraftActivitiesOnDeletion: false,
          liveQuizzes: [
            { id: 'live-quiz-id', status: PublicationStatus.PUBLISHED },
          ],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.ADMIN,
        }),
      },
    }
    const emitter = { emit: vi.fn() }

    await handleProcessCourseDeletion(
      {
        courseId: 'course-id',
        deletionRequestedAt: requestedAt.toISOString(),
      },
      { prisma, emitter } as any,
      executionContext()
    )

    expect(prisma.course.updateMany).toHaveBeenCalledWith({
      where: { id: 'course-id', deletionRequestedAt: requestedAt },
      data: {
        deletionRequestedAt: null,
        deletionRequestedById: null,
        deleteDraftActivitiesOnDeletion: false,
      },
    })
    expect(permanentDeletion).not.toHaveBeenCalled()
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Course',
      id: 'course-id',
    })
  })

  it('republishes pending requests and warns about stale ones', async () => {
    const deletionRequestedAt = new Date(Date.now() - 76 * 60 * 1000)
    const push = vi.fn()
    const logger = executionContext().logger

    await handleSweepCourseDeletions(
      {},
      {
        prisma: {
          course: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ id: 'course-id', deletionRequestedAt }]),
          },
        },
        hatchet: { events: { push } },
      } as any,
      { logger } as any
    )

    expect(push).toHaveBeenCalledWith('process-course-deletion', {
      courseId: 'course-id',
      deletionRequestedAt: deletionRequestedAt.toISOString(),
    })
    expect(logger.warn).toHaveBeenCalledWith(
      'Course deletion request for course-id has been pending for more than 75 minutes.'
    )
  })
})
