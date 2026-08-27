import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { setCourseLearningAnalyticsEnabled } from '../src/services/courses.js'

function createContext({
  currentEnabled,
  invalidatedAt = new Date('2026-08-27T01:00:00.000Z'),
}: {
  currentEnabled: boolean
  invalidatedAt?: Date
}) {
  const course = {
    id: 'course-id',
    isLearningAnalyticsEnabled: currentEnabled,
  }
  const transactionClient = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ invalidatedAt }]),
    course: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ isLearningAnalyticsEnabled: currentEnabled })
        .mockResolvedValue(course),
      update: vi.fn().mockResolvedValue(course),
    },
  }
  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient)
    ),
  }
  const ctx = { prisma } as unknown as ContextWithUser

  return { ctx, transactionClient, invalidatedAt }
}

describe('setCourseLearningAnalyticsEnabled', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the course without invalidating analytics when state is unchanged', async () => {
    const { ctx, transactionClient } = createContext({
      currentEnabled: true,
    })

    await expect(
      setCourseLearningAnalyticsEnabled(
        { courseId: 'course-id', isEnabled: true },
        ctx
      )
    ).resolves.toEqual({
      id: 'course-id',
      isLearningAnalyticsEnabled: true,
    })

    expect(transactionClient.$executeRaw).toHaveBeenCalledTimes(2)
    expect(transactionClient.$queryRaw).not.toHaveBeenCalled()
    expect(transactionClient.course.update).not.toHaveBeenCalled()
  })

  it('invalidates every published analytics marker when state changes', async () => {
    const { ctx, transactionClient, invalidatedAt } = createContext({
      currentEnabled: false,
    })

    await setCourseLearningAnalyticsEnabled(
      { courseId: 'course-id', isEnabled: true },
      ctx
    )

    expect(transactionClient.$executeRaw).toHaveBeenCalledTimes(2)
    expect(
      transactionClient.$executeRaw.mock.invocationCallOrder[1]!
    ).toBeLessThan(
      transactionClient.course.findUnique.mock.invocationCallOrder[0]!
    )
    expect(transactionClient.course.update).toHaveBeenCalledWith({
      where: { id: 'course-id' },
      data: {
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: false,
        analyticsLastComputedAt: invalidatedAt,
        analyticsFinalizedAt: null,
        chatAnalyticsValidAt: null,
      },
    })
  })
})
