import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { handleProcessCourseDuplication } from '../src/services/courseDuplication.js'

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
})
