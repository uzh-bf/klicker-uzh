import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getActivityAnalytics,
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
  getCourseWeeklyActivity,
} from '../src/services/analytics.js'

const courseId = '10000000-0000-4000-8000-000000000001'
const activityId = '20000000-0000-4000-8000-000000000001'
const participantId = '30000000-0000-4000-8000-000000000001'

type IndividualRelationWhere = {
  participantId?: { in?: string[] }
  course?: { isArchived?: boolean }
}

type AnalyticsReadArgs = {
  where?: {
    id?: string
    isLearningAnalyticsEnabled?: boolean
    areAnalyticsValid?: boolean
  }
  include?: {
    participantCourseAnalytics?: { where?: IndividualRelationWhere }
    participantPerformances?: { where?: IndividualRelationWhere }
  }
}

function queryText(query: unknown) {
  if (Array.isArray(query)) return query.join(' ')
  return (query as { strings?: string[] }).strings?.join(' ') ?? ''
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
    const filterRows = (
      rows: unknown,
      where: IndividualRelationWhere | undefined
    ) => {
      if (!Array.isArray(rows) || !where?.participantId?.in) return rows

      return rows.filter((row) => {
        if (!row || typeof row !== 'object') return false
        const rowParticipantId = (row as { participantId?: unknown })
          .participantId
        if (typeof rowParticipantId !== 'string') return true
        if (course.isArchived === true && where.course?.isArchived === false) {
          return false
        }
        return where.participantId!.in!.includes(rowParticipantId)
      })
    }

    if (args?.include?.participantCourseAnalytics) {
      result.participantCourseAnalytics = filterRows(
        result.participantCourseAnalytics,
        args.include.participantCourseAnalytics.where
      )
    }
    if (args?.include?.participantPerformances) {
      result.participantPerformances = filterRows(
        result.participantPerformances,
        args.include.participantPerformances.where
      )
    }

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

  it('does not expose individual rows after course membership is removed', async () => {
    const fixture = analyticsContext({
      course: {
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
        isArchived: false,
        participations: [],
        aggregatedAnalytics: [],
        aggregatedCourseAnalytics: null,
        participantCourseAnalytics: [{ participantId, activeWeeks: 1 }],
        _count: { participations: 0 },
        practiceQuizzes: [],
        microLearnings: [],
        participantPerformances: [{ participantId }],
      },
    })
    fixture.queryRaw.mockImplementation(async (query: unknown) => {
      const sql = queryText(query)
      return sql.includes('JOIN "Participation" AS membership')
        ? []
        : [{ participantId }]
    })

    const activityResult = await getCourseActivityAnalytics(
      { courseId },
      fixture.ctx
    )
    const performanceResult = await getCoursePerformanceAnalytics(
      { courseId },
      fixture.ctx
    )

    expect(activityResult?.participantCourseAnalytics).toHaveLength(0)
    expect(performanceResult?.participantPerformances).toHaveLength(0)
    expect(fixture.queryRaw).toHaveBeenCalledTimes(2)
    for (const [query] of fixture.queryRaw.mock.calls) {
      const sql = queryText(query)
      expect(sql).toContain('JOIN "Participation" AS membership')
      expect(sql).toContain('membership."courseId"')
      expect(sql).toContain('membership."participantId"')
    }
  })

  it('does not expose individual rows for archived courses', async () => {
    const fixture = analyticsContext({
      course: {
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
        isArchived: true,
        participations: [{ id: 'participation' }],
        aggregatedAnalytics: [
          {
            type: 'DAILY',
            timestamp: new Date('2026-08-27T00:00:00.000Z'),
            participantCount: 1,
          },
        ],
        aggregatedCourseAnalytics: null,
        participantCourseAnalytics: [{ participantId, activeWeeks: 1 }],
        _count: { participations: 1 },
        practiceQuizzes: [],
        microLearnings: [],
        participantPerformances: [{ participantId }],
      },
    })
    fixture.queryRaw.mockImplementation(async (query: unknown) => {
      const sql = queryText(query)
      return sql.includes('c."isArchived" IS FALSE') ? [] : [{ participantId }]
    })

    const activityResult = await getCourseActivityAnalytics(
      { courseId },
      fixture.ctx
    )
    const performanceResult = await getCoursePerformanceAnalytics(
      { courseId },
      fixture.ctx
    )

    expect(activityResult?.participantCourseAnalytics).toHaveLength(0)
    expect(activityResult?.dailyActivity).toHaveLength(1)
    expect(performanceResult?.participantPerformances).toHaveLength(0)
    expect(fixture.queryRaw).toHaveBeenCalledTimes(2)
    for (const [query] of fixture.queryRaw.mock.calls) {
      expect(queryText(query)).toContain('c."isArchived" IS FALSE')
    }

    const activityCall = fixture.courseFindUnique.mock.calls[0]?.[0]
    expect(
      activityCall?.include?.participantCourseAnalytics?.where
    ).toMatchObject({ course: { isArchived: false } })
    const performanceCall = fixture.courseFindUnique.mock.calls[1]?.[0]
    expect(
      performanceCall?.include?.participantPerformances?.where
    ).toMatchObject({ course: { isArchived: false } })
  })

  it('filters individual rows by current consent metadata without a historical boundary', async () => {
    const fixture = analyticsContext({
      course: {
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
        participations: [],
        aggregatedAnalytics: [],
        aggregatedCourseAnalytics: null,
        participantCourseAnalytics: [],
        _count: { participations: 0 },
        practiceQuizzes: [],
        microLearnings: [],
        participantPerformances: [],
      },
    })

    await getCourseActivityAnalytics({ courseId }, fixture.ctx)
    await getCoursePerformanceAnalytics({ courseId }, fixture.ctx)

    expect(fixture.queryRaw).toHaveBeenCalledTimes(2)
    for (const [query] of fixture.queryRaw.mock.calls) {
      const queryText = Array.isArray(query)
        ? query.join(' ')
        : (query as { strings?: string[] }).strings?.join(' ')
      if (!queryText) throw new Error('missing analytics query text')
      expect(queryText).toContain('learningAnalyticsConsent')
      expect(queryText).toContain('learningAnalyticsChoiceAt')
      expect(queryText).toContain('learningAnalyticsDisclosureVersion')
      expect(queryText).toContain('analyticsLastComputedAt')
      expect(queryText).toMatch(
        /analyticsLastComputedAt"\s*>\s*p\.\"learningAnalyticsChoiceAt/
      )
      expect(queryText).not.toMatch(/included|boundary/i)
    }
  })
})
