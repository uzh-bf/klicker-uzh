import { randomUUID } from 'node:crypto'
import { COURSE_DUPLICATION_ERROR_CODES } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  getCourseDuplicationStatuses,
  handleProcessCourseDuplication,
  handleSweepStaleCourseDuplications,
  startCourseDuplication,
} from '../src/services/courseDuplication.js'

describe('course duplication task durability', () => {
  it('retries a terminal job when the durable task cannot be synchronized', async () => {
    const jobId = randomUUID()
    const now = new Date().toISOString()
    const redis = {
      eval: vi.fn(async () => 1),
      get: vi.fn(async () =>
        JSON.stringify({
          id: jobId,
          status: 'COMPLETED',
          sourceCourseId: randomUUID(),
          sourceCourseName: 'Source course',
          targetCourseName: 'Copied course',
          createdCourseId: jobId,
          createdAt: now,
          updatedAt: now,
          userId: randomUUID(),
        })
      ),
    }
    const syncError = new Error('task database unavailable')
    const prisma = {
      asyncTask: {
        updateMany: vi.fn(async () => {
          throw syncError
        }),
      },
    }
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    }

    await expect(
      handleProcessCourseDuplication(
        { jobId },
        { prisma, redisExec: redis } as never,
        { logger } as never
      )
    ).rejects.toBe(syncError)

    expect(logger.error).toHaveBeenCalledWith(
      `Failed to restore async task ${jobId}: ${syncError.message}`
    )
    expect(redis.eval).toHaveBeenCalledOnce()
  })

  it('preserves the synchronization failure when releasing the source lock also fails', async () => {
    const jobId = randomUUID()
    const now = new Date().toISOString()
    const releaseError = new Error('redis unavailable')
    const redis = {
      eval: vi.fn(async () => {
        throw releaseError
      }),
      get: vi.fn(async () =>
        JSON.stringify({
          id: jobId,
          status: 'COMPLETED',
          sourceCourseId: randomUUID(),
          sourceCourseName: 'Source course',
          targetCourseName: 'Copied course',
          createdCourseId: jobId,
          createdAt: now,
          updatedAt: now,
          userId: randomUUID(),
        })
      ),
    }
    const syncError = new Error('task database unavailable')
    const prisma = {
      asyncTask: {
        updateMany: vi.fn(async () => {
          throw syncError
        }),
      },
    }
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    }

    await expect(
      handleProcessCourseDuplication(
        { jobId },
        { prisma, redisExec: redis } as never,
        { logger } as never
      )
    ).rejects.toBe(syncError)

    expect(logger.warn).toHaveBeenCalledWith(
      `Failed to release course duplication source lock for job ${jobId}: ${releaseError.message}`
    )
  })

  it('keeps a failed Redis job when its durable task cannot be created', async () => {
    const sourceCourseId = randomUUID()
    const initialSyncError = new Error('task database unavailable')
    const failedSyncError = new Error('failed task database unavailable')
    const redis = {
      del: vi.fn(async () => 1),
      eval: vi.fn(async () => 1),
      get: vi.fn(async () => null),
      set: vi.fn(async (..._args: unknown[]) => 'OK'),
    }
    const prisma = {
      asyncTask: {
        findUnique: vi.fn(async () => {
          throw initialSyncError
        }),
        updateMany: vi.fn(async () => {
          throw failedSyncError
        }),
      },
      course: {
        findUnique: vi.fn(async () => ({ name: 'Source course' })),
      },
      derivedPermission: {
        findUnique: vi.fn(async () => ({ id: randomUUID() })),
      },
    }
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      await expect(
        startCourseDuplication(
          {
            name: 'Copied course',
            sourceCourseId,
          } as never,
          {
            hatchet: { events: { push: vi.fn() } },
            prisma,
            redisExec: redis,
            user: {
              catalystIndividual: false,
              catalystInstitutional: false,
              role: 'USER',
              scope: 'FULL_ACCESS',
              sub: randomUUID(),
            },
          } as never
        )
      ).rejects.toMatchObject({
        extensions: { code: COURSE_DUPLICATION_ERROR_CODES.startFailed },
      })
    } finally {
      consoleError.mockRestore()
    }

    expect(redis.set).toHaveBeenCalledTimes(3)
    expect(
      redis.set.mock.calls.some((call) => {
        const value = call[1]
        if (typeof value !== 'string' || !value.startsWith('{')) return false
        const persistedJob = JSON.parse(value) as { status: string }
        return persistedJob.status === 'FAILED'
      })
    ).toBe(true)
    expect(redis.del).not.toHaveBeenCalled()
    expect(redis.eval).toHaveBeenCalledOnce()
  })

  it('releases orphaned terminal locks during a sweep even when task sync fails', async () => {
    const jobId = randomUUID()
    const now = new Date().toISOString()
    const redis = {
      scan: vi.fn(async () => ['0', [`course-duplication:${jobId}`]]),
      get: vi.fn(async () =>
        JSON.stringify({
          id: jobId,
          status: 'FAILED',
          sourceCourseId: randomUUID(),
          sourceCourseName: 'Source course',
          targetCourseName: 'Copied course',
          createdAt: now,
          updatedAt: now,
          userId: randomUUID(),
        })
      ),
      eval: vi.fn(async () => 1),
    }
    const prisma = {
      asyncTask: {
        updateMany: vi.fn(async () => {
          throw new Error('task database unavailable')
        }),
      },
    }
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() }

    await expect(
      handleSweepStaleCourseDuplications(
        {},
        { prisma, redisExec: redis } as never,
        { logger } as never
      )
    ).resolves.toBe(true)

    expect(redis.eval).toHaveBeenCalledOnce()
    expect(prisma.asyncTask.updateMany).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restore async task')
    )
  })

  it('synchronizes a normalized stale job only once when reading statuses', async () => {
    const jobId = randomUUID()
    const userId = randomUUID()
    const staleTime = new Date(0).toISOString()
    const redis = {
      get: vi.fn(async () =>
        JSON.stringify({
          id: jobId,
          status: 'RUNNING',
          sourceCourseId: randomUUID(),
          sourceCourseName: 'Source course',
          targetCourseName: 'Copied course',
          createdAt: staleTime,
          updatedAt: staleTime,
          userId,
        })
      ),
      set: vi.fn(async () => 'OK'),
      eval: vi.fn(async () => 1),
    }
    const prisma = {
      course: { findUnique: vi.fn(async () => ({ id: jobId })) },
      asyncTask: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => ({ id: jobId })),
      },
    }

    const statuses = await getCourseDuplicationStatuses({ ids: [jobId] }, {
      prisma,
      redisExec: redis,
      user: { sub: userId },
    } as never)

    expect(statuses[0]?.status).toBe('COMPLETED')
    expect(prisma.asyncTask.updateMany).toHaveBeenCalledOnce()
  })
})
