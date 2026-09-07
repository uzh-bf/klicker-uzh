import { beforeEach, describe, expect, it, vi } from 'vitest'

const courseMocks = vi.hoisted(() => ({
  deleteCourse: vi.fn(),
  cancelCourseDeletionRequest: vi.fn(),
}))

vi.mock('../src/services/courses.js', () => courseMocks)

import {
  COURSE_DELETION_MAX_RETRIES,
  handleProcessCourseDeletion,
  requestCourseDeletion,
} from '../src/services/courseDeletion.js'

function executionContext(retryCount = 0) {
  return {
    retryCount: () => retryCount,
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  } as any
}

function requestContext(course: Record<string, unknown>) {
  const transactionClient = {
    course: {
      findUnique: vi.fn().mockResolvedValue(course),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
  const hatchet = { events: { push: vi.fn() } }
  const emitter = { emit: vi.fn() }
  const ctx = {
    prisma: {
      $transaction: vi.fn((callback: (client: any) => unknown) =>
        callback(transactionClient)
      ),
    },
    hatchet,
    emitter,
    user: { sub: 'requester-id' },
  } as any

  return { ctx, transactionClient, hatchet, emitter }
}

describe('course deletion requests', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks the course and publishes the Hatchet event with the request options', async () => {
    const { ctx, transactionClient, hatchet } = requestContext({
      id: 'course-id',
      deletionRequestedAt: null,
      liveQuizzes: [],
    })

    const request = await requestCourseDeletion(
      { id: 'course-id', deleteDraftActivities: true },
      ctx
    )

    expect(transactionClient.course.updateMany).toHaveBeenCalledWith({
      where: { id: 'course-id', deletionRequestedAt: null },
      data: { deletionRequestedAt: expect.any(Date) },
    })
    expect(hatchet.events.push).toHaveBeenCalledWith(
      'process-course-deletion',
      {
        courseId: 'course-id',
        deletionRequestedAt: request.deletionRequestedAt.toISOString(),
        requestedById: 'requester-id',
        deleteDraftActivities: true,
      }
    )
    expect(request.courseId).toBe('course-id')
  })

  it('rejects a course with a published live quiz', async () => {
    const { ctx, transactionClient } = requestContext({
      id: 'course-id',
      deletionRequestedAt: null,
      liveQuizzes: [{ id: 'live-quiz-id' }],
    })

    await expect(
      requestCourseDeletion({ id: 'course-id' }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'COURSE_DELETION_ACTIVE_LIVE_QUIZ' },
    })
    expect(transactionClient.course.updateMany).not.toHaveBeenCalled()
  })

  it('does not publish again for a course that is already pending', async () => {
    const deletionRequestedAt = new Date('2026-01-01T00:00:00.000Z')
    const { ctx, transactionClient, hatchet } = requestContext({
      id: 'course-id',
      deletionRequestedAt,
      liveQuizzes: [],
    })

    const request = await requestCourseDeletion({ id: 'course-id' }, ctx)

    expect(request.deletionRequestedAt).toBe(deletionRequestedAt)
    expect(transactionClient.course.updateMany).not.toHaveBeenCalled()
    expect(hatchet.events.push).not.toHaveBeenCalled()
  })

  it('clears the marker and fails when the event cannot be published', async () => {
    const { ctx, hatchet } = requestContext({
      id: 'course-id',
      deletionRequestedAt: null,
      liveQuizzes: [],
    })
    hatchet.events.push.mockRejectedValue(new Error('hatchet down'))

    await expect(
      requestCourseDeletion({ id: 'course-id' }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'COURSE_DELETION_UNAVAILABLE' },
    })
    expect(courseMocks.cancelCourseDeletionRequest).toHaveBeenCalledWith(
      { id: 'course-id', deletionRequestedAt: expect.any(Date) },
      ctx
    )
  })
})

describe('course deletion worker', () => {
  beforeEach(() => vi.clearAllMocks())

  const event = {
    courseId: 'course-id',
    deletionRequestedAt: '2026-01-01T00:00:00.000Z',
    requestedById: 'requester-id',
    deleteDraftActivities: true,
  }

  it('runs the permanent deletion for the request', async () => {
    const globalContext = { prisma: {}, emitter: { emit: vi.fn() } } as any

    await expect(
      handleProcessCourseDeletion(event, globalContext, executionContext())
    ).resolves.toBe(true)

    expect(courseMocks.deleteCourse).toHaveBeenCalledWith(
      {
        id: 'course-id',
        deleteDraftActivities: true,
        request: {
          deletionRequestedAt: new Date(event.deletionRequestedAt),
          requestedById: 'requester-id',
        },
      },
      globalContext
    )
    expect(courseMocks.cancelCourseDeletionRequest).not.toHaveBeenCalled()
  })

  it('keeps the marker while retries remain', async () => {
    courseMocks.deleteCourse.mockRejectedValueOnce(new Error('transient'))

    await expect(
      handleProcessCourseDeletion(event, {} as any, executionContext(0))
    ).rejects.toThrow('transient')

    expect(courseMocks.cancelCourseDeletionRequest).not.toHaveBeenCalled()
  })

  it('clears the marker when the last retry fails', async () => {
    courseMocks.deleteCourse.mockRejectedValueOnce(new Error('broken'))
    const globalContext = {} as any

    await expect(
      handleProcessCourseDeletion(
        event,
        globalContext,
        executionContext(COURSE_DELETION_MAX_RETRIES)
      )
    ).rejects.toThrow('broken')

    expect(courseMocks.cancelCourseDeletionRequest).toHaveBeenCalledWith(
      {
        id: 'course-id',
        deletionRequestedAt: new Date(event.deletionRequestedAt),
      },
      globalContext
    )
  })
})
