import { ANALYTICS_ENGINE_CONTRACT_VERSION } from '@klicker-uzh/analytics-engine-contract'
import { prisma } from '@klicker-uzh/prisma'
import {
  ActivityLevel,
  AnalyticsType,
  CourseAuthType,
  PerformanceLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { setLearningAnalyticsConsent } from '../src/services/participants.js'
import {
  completeLearningAnalyticsCourse,
  startLearningAnalyticsCourse,
} from '../src/services/learningAnalyticsCoordinator.js'
import {
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
} from '../src/services/analytics.js'

const TEST_PREFIX = `learning-analytics-coordinator-integration-${Date.now()}`
const fixtureIds = {
  courses: [] as string[],
  participants: [] as string[],
  users: [] as string[],
}

function participantContext(participantId: string): ContextWithUser {
  return {
    prisma,
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

describe('learning-analytics coordinator PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterEach(async () => {
    if (fixtureIds.courses.length > 0) {
      await prisma.course.deleteMany({
        where: { id: { in: fixtureIds.courses } },
      })
      fixtureIds.courses.length = 0
    }
    if (fixtureIds.participants.length > 0) {
      await prisma.participant.deleteMany({
        where: { id: { in: fixtureIds.participants } },
      })
      fixtureIds.participants.length = 0
    }
    if (fixtureIds.users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: fixtureIds.users } } })
      fixtureIds.users.length = 0
    }
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects an in-flight recomputation after consent changes and accepts a fresh run', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}@example.test`,
        shortname: TEST_PREFIX,
      },
    })
    fixtureIds.users.push(user.id)

    const participant = await prisma.participant.create({
      data: {
        username: `${TEST_PREFIX}-participant`,
        password: 'integration-test-password',
      },
    })
    fixtureIds.participants.push(participant.id)

    const course = await prisma.course.create({
      data: {
        name: TEST_PREFIX,
        displayName: TEST_PREFIX,
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-09-01T00:00:00.000Z'),
        groupDeadlineDate: new Date('2026-09-01T00:00:00.000Z'),
        authType: CourseAuthType.SSO,
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
        ownerId: user.id,
        participations: { create: { participantId: participant.id } },
      },
    })
    fixtureIds.courses.push(course.id)

    await prisma.participantCourseAnalytics.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        activeWeeks: 1,
        activeDaysPerWeek: 1,
        meanElementsPerDay: 1,
        activityLevel: ActivityLevel.MEDIUM,
      },
    })
    await prisma.participantPerformance.create({
      data: {
        firstErrorRate: 0.1,
        firstPerformance: PerformanceLevel.HIGH,
        lastErrorRate: 0.1,
        lastPerformance: PerformanceLevel.HIGH,
        totalErrorRate: 0.1,
        totalPerformance: PerformanceLevel.HIGH,
        courseId: course.id,
        participantId: participant.id,
      },
    })
    await prisma.aggregatedAnalytics.create({
      data: {
        courseId: course.id,
        type: AnalyticsType.DAILY,
        timestamp: new Date('2026-08-25T00:00:00.000Z'),
        responseCount: 1,
        participantCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        totalElementsAvailable: 1,
      },
    })

    const request = {
      contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
      runId: '00000000-0000-0000-0000-000000000001',
      courseId: course.id,
      mode: 'full' as const,
    }
    const ctx = participantContext(participant.id)

    const started = await startLearningAnalyticsCourse(request, prisma)
    expect(started.courseId).toBe(course.id)
    expect(started.fenceAt).toMatch(/Z$/)

    const enabled = await setLearningAnalyticsConsent({ consent: true }, ctx)
    expect(enabled?.learningAnalyticsConsent).toBe(true)
    expect(enabled?.learningAnalyticsChoiceAt).toBeInstanceOf(Date)
    expect(
      enabled!.learningAnalyticsChoiceAt!.getTime()
    ).toBeGreaterThanOrEqual(Date.parse(started.fenceAt))

    const firstCompletedAt = new Date(Date.now() + 1_000).toISOString()
    await completeLearningAnalyticsCourse(
      {
        request,
        completedAt: firstCompletedAt,
        cleanupOnly: false,
        fenceAt: started.fenceAt,
      },
      prisma
    )

    await expect(
      prisma.course.findUnique({
        where: { id: course.id },
        select: {
          areAnalyticsValid: true,
          analyticsLastComputedAt: true,
          chatAnalyticsValidAt: true,
        },
      })
    ).resolves.toEqual({
      areAnalyticsValid: false,
      analyticsLastComputedAt: null,
      chatAnalyticsValidAt: null,
    })
    const hiddenAfterRejectedCompletion = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(hiddenAfterRejectedCompletion).toBeNull()

    const freshRequest = {
      ...request,
      runId: '00000000-0000-0000-0000-000000000002',
    }
    const freshStart = await startLearningAnalyticsCourse(freshRequest, prisma)
    const freshCompletedAt = new Date(Date.now() + 2_000).toISOString()
    await completeLearningAnalyticsCourse(
      {
        request: freshRequest,
        completedAt: freshCompletedAt,
        cleanupOnly: false,
        fenceAt: freshStart.fenceAt,
      },
      prisma
    )

    await expect(
      prisma.course.findUnique({
        where: { id: course.id },
        select: {
          areAnalyticsValid: true,
          analyticsLastComputedAt: true,
          chatAnalyticsValidAt: true,
        },
      })
    ).resolves.toMatchObject({
      areAnalyticsValid: true,
      analyticsLastComputedAt: new Date(freshCompletedAt),
      chatAnalyticsValidAt: new Date(freshCompletedAt),
    })
    const visibleAfterFreshCompletion = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(
      visibleAfterFreshCompletion?.participantCourseAnalytics
    ).toHaveLength(1)
    const visiblePerformanceAfterFreshCompletion =
      await getCoursePerformanceAnalytics({ courseId: course.id }, ctx)
    expect(
      visiblePerformanceAfterFreshCompletion?.participantPerformances
    ).toHaveLength(1)

    await prisma.participation.delete({
      where: {
        courseId_participantId: {
          courseId: course.id,
          participantId: participant.id,
        },
      },
    })
    const hiddenAfterMembershipRemoval = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(
      hiddenAfterMembershipRemoval?.participantCourseAnalytics
    ).toHaveLength(0)
    const hiddenPerformanceAfterMembershipRemoval =
      await getCoursePerformanceAnalytics({ courseId: course.id }, ctx)
    expect(
      hiddenPerformanceAfterMembershipRemoval?.participantPerformances
    ).toHaveLength(0)

    await prisma.participation.create({
      data: { courseId: course.id, participantId: participant.id },
    })
    await prisma.course.update({
      where: { id: course.id },
      data: { isArchived: true },
    })
    const hiddenAfterArchive = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(hiddenAfterArchive?.participantCourseAnalytics).toHaveLength(0)
    expect(hiddenAfterArchive?.dailyActivity).toHaveLength(1)
    const hiddenPerformanceAfterArchive = await getCoursePerformanceAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(hiddenPerformanceAfterArchive?.participantPerformances).toHaveLength(
      0
    )
  })
})
