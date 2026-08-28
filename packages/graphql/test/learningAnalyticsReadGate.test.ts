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
    isArchived?: boolean
    isLearningAnalyticsEnabled?: boolean
    areAnalyticsValid?: boolean
  }
}

function analyticsContext({
  course = { isLearningAnalyticsEnabled: false, areAnalyticsValid: true },
  activity = null,
  eligibleParticipantIds = [],
  participantAnalyticsRows = [],
}: {
  course?: {
    isLearningAnalyticsEnabled: boolean
    areAnalyticsValid: boolean
    [key: string]: unknown
  }
  activity?: unknown
  eligibleParticipantIds?: string[]
  participantAnalyticsRows?: Array<{
    timestamp: Date
    participantId: string
  }>
} = {}) {
  const courseFindUnique = vi.fn(async (args?: AnalyticsReadArgs) => {
    if (
      (args?.where?.isArchived === false && course.isArchived === true) ||
      (args?.where?.isLearningAnalyticsEnabled === true &&
        args.where.areAnalyticsValid === true &&
        (!course.isLearningAnalyticsEnabled || !course.areAnalyticsValid))
    ) {
      return null
    }

    const result = { ...course }
    return result
  })
  const queryRaw = vi.fn(async (_query: unknown) =>
    eligibleParticipantIds.map((eligibleParticipantId) => ({
      participantId: eligibleParticipantId,
    }))
  )
  const transactionClient = {
    $queryRaw: queryRaw,
    course: { findUnique: courseFindUnique },
    participantAnalytics: {
      findMany: vi.fn(async () => participantAnalyticsRows),
    },
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

  it('returns no V2 analytics for an archived course', async () => {
    const archived = analyticsContext({
      course: {
        isArchived: true,
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
      },
    })

    await expect(
      getCourseActivityAnalyticsV2({ courseId }, archived.ctx)
    ).resolves.toBeNull()
    await expect(
      getCoursePerformanceAnalyticsV2({ courseId }, archived.ctx)
    ).resolves.toBeNull()
    await expect(
      getCourseLearningAnalyticsExportV2(
        { courseId, format: 'JSON' },
        archived.ctx
      )
    ).resolves.toBeNull()

    for (const call of archived.courseFindUnique.mock.calls) {
      expect(call[0]?.where).toMatchObject({
        id: courseId,
        isArchived: false,
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
      })
    }
  })

  it('uses the shared eligible membership cohort for V2 performance suppression', async () => {
    const eligibleParticipantIds = Array.from(
      { length: 6 },
      (_, index) =>
        `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    )
    const fixture = analyticsContext({
      eligibleParticipantIds,
      course: {
        isArchived: false,
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
        practiceQuizzes: [
          {
            participantPerformances: eligibleParticipantIds
              .slice(0, 5)
              .map((performanceParticipantId) => ({
                participantId: performanceParticipantId,
                completion: 1,
              })),
          },
        ],
        microLearnings: [],
      },
    })

    await expect(
      getCoursePerformanceAnalyticsV2({ courseId }, fixture.ctx)
    ).resolves.toEqual({
      isSuppressed: true,
      effectiveN: null,
      activitySummaries: [],
      studentReport: {
        isSuppressed: true,
        effectiveN: null,
        students: [],
      },
    })

    const eligibilityQuery = fixture.queryRaw.mock.calls[0]?.[0] as
      | string[]
      | { strings?: string[] }
    const eligibilitySql = Array.isArray(eligibilityQuery)
      ? eligibilityQuery.join(' ')
      : (eligibilityQuery.strings?.join(' ') ?? '')
    expect(eligibilitySql).toContain('FROM "Participation" AS membership')
    expect(eligibilitySql).not.toContain('ParticipantPerformance')
    expect(eligibilitySql).not.toContain('ParticipantActivityPerformance')
  })

  it('uses the shared eligible membership cohort for V2 activity suppression', async () => {
    const eligibleParticipantIds = Array.from(
      { length: 6 },
      (_, index) =>
        `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    )
    const fixture = analyticsContext({
      eligibleParticipantIds,
      participantAnalyticsRows: eligibleParticipantIds
        .slice(0, 5)
        .map((analyticsParticipantId) => ({
          timestamp: new Date('2026-01-05T00:00:00.000Z'),
          participantId: analyticsParticipantId,
        })),
      course: {
        isArchived: false,
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
      },
    })

    await expect(
      getCourseActivityAnalyticsV2({ courseId }, fixture.ctx)
    ).resolves.toEqual({
      isSuppressed: false,
      effectiveN: 6,
      weeklyActivity: [],
    })

    const eligibilityQuery = fixture.queryRaw.mock.calls[0]?.[0] as
      | string[]
      | { strings?: string[] }
    const eligibilitySql = Array.isArray(eligibilityQuery)
      ? eligibilityQuery.join(' ')
      : (eligibilityQuery.strings?.join(' ') ?? '')
    expect(eligibilitySql).toContain('FROM "Participation" AS membership')
    expect(eligibilitySql).not.toContain('ParticipantCourseAnalytics')
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
