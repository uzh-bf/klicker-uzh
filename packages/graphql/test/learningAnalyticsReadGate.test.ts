import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getActivityAnalytics,
  getCourseActivityAnalytics,
  getCourseActivityAnalyticsV2,
  getCourseLearningAnalyticsExportV2,
  getCoursePerformanceAnalytics,
  getCoursePerformanceAnalyticsV2,
  getCourseWeeklyActivity,
} from '../src/services/analytics.js'

const courseId = '10000000-0000-4000-8000-000000000001'
const activityId = '20000000-0000-4000-8000-000000000001'
const participantId = '30000000-0000-4000-8000-000000000001'

type AnalyticsReadArgs = {
  where?: {
    id?: string
    isLearningAnalyticsEnabled?: boolean
    areAnalyticsValid?: boolean
  }
}

function analyticsContext({
  course = { isLearningAnalyticsEnabled: false, areAnalyticsValid: true },
  activity = null,
}: {
  course?: {
    isLearningAnalyticsEnabled: boolean
    areAnalyticsValid: boolean
    [key: string]: unknown
  }
  activity?: unknown
} = {}) {
  const courseFindUnique = vi.fn(async (args?: AnalyticsReadArgs) => {
    if (
      args?.where?.isLearningAnalyticsEnabled === true &&
      args.where.areAnalyticsValid === true &&
      (!course.isLearningAnalyticsEnabled || !course.areAnalyticsValid)
    ) {
      return null
    }

    const result = { ...course }
    return result
  })
  const queryRaw = vi.fn(
    async (_query: unknown) => [] as { participantId: string }[]
  )
  const transactionClient = {
    $queryRaw: queryRaw,
    course: { findUnique: courseFindUnique },
  }
  const practiceQuizFindUnique = vi.fn(async () => {
    if (
      activity &&
      (!course.isLearningAnalyticsEnabled || !course.areAnalyticsValid)
    ) {
      return null
    }
    return activity
  })
  const microLearningFindUnique = vi.fn(async () => null)
  const prisma = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient)
    ),
    course: { findUnique: courseFindUnique },
    practiceQuiz: { findUnique: practiceQuizFindUnique },
    microLearning: { findUnique: microLearningFindUnique },
  }

  return {
    ctx: {
      prisma,
      user: { sub: participantId },
    } as unknown as ContextWithUser,
    courseFindUnique,
    practiceQuizFindUnique,
    queryRaw,
  }
}

describe('learning analytics read gate', () => {
  it('returns no analytics while the course is disabled or its result is invalid', async () => {
    const disabled = analyticsContext()

    await expect(
      getCourseActivityAnalytics({ courseId }, disabled.ctx)
    ).resolves.toBeNull()
    await expect(
      getCourseWeeklyActivity({ courseId }, disabled.ctx)
    ).resolves.toBeNull()
    await expect(
      getCoursePerformanceAnalytics({ courseId }, disabled.ctx)
    ).resolves.toBeNull()
    await expect(
      getCourseActivityAnalyticsV2({ courseId }, disabled.ctx)
    ).resolves.toBeNull()
    await expect(
      getCoursePerformanceAnalyticsV2({ courseId }, disabled.ctx)
    ).resolves.toBeNull()
    await expect(
      getCourseLearningAnalyticsExportV2(
        { courseId, format: 'CSV' },
        disabled.ctx
      )
    ).resolves.toBeNull()

    const invalid = analyticsContext({
      course: { isLearningAnalyticsEnabled: true, areAnalyticsValid: false },
    })
    await expect(
      getCourseActivityAnalytics({ courseId }, invalid.ctx)
    ).resolves.toBeNull()
    await expect(
      getCourseWeeklyActivity({ courseId }, invalid.ctx)
    ).resolves.toBeNull()
    await expect(
      getCoursePerformanceAnalytics({ courseId }, invalid.ctx)
    ).resolves.toBeNull()
    await expect(
      getCourseActivityAnalyticsV2({ courseId }, invalid.ctx)
    ).resolves.toBeNull()
    await expect(
      getCoursePerformanceAnalyticsV2({ courseId }, invalid.ctx)
    ).resolves.toBeNull()
    await expect(
      getCourseLearningAnalyticsExportV2(
        { courseId, format: 'JSON' },
        invalid.ctx
      )
    ).resolves.toBeNull()

    for (const call of disabled.courseFindUnique.mock.calls) {
      expect(call[0]?.where).toMatchObject({
        id: courseId,
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
      })
    }
    for (const call of invalid.courseFindUnique.mock.calls) {
      expect(call[0]?.where).toMatchObject({
        id: courseId,
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
      })
    }
  })

  it('gates individual activity analytics by the owning course state', async () => {
    const fixture = analyticsContext({
      course: { isLearningAnalyticsEnabled: true, areAnalyticsValid: false },
      activity: {
        course: {
          isLearningAnalyticsEnabled: true,
          areAnalyticsValid: false,
        },
        stacks: [],
      },
    })

    await expect(
      getActivityAnalytics({ activityId }, fixture.ctx)
    ).resolves.toBeNull()
    expect(fixture.practiceQuizFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: activityId,
          course: { isLearningAnalyticsEnabled: true, areAnalyticsValid: true },
        }),
      })
    )
  })
})
