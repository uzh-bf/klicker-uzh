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
import {
  LEARNING_ANALYTICS_ADVISORY_LOCK,
  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
} from '../src/lib/learningAnalytics.js'
import {
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
} from '../src/services/analytics.js'
import {
  getParticipantDataUse,
  setLearningAnalyticsConsent,
  setResearchConsent,
} from '../src/services/participants.js'

const TEST_PREFIX = `participant-data-use-integration-${Date.now()}`
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

function defer() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function holdLearningAnalyticsWriterGate() {
  const acquired = defer()
  const release = defer()
  const transaction = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock_shared(
          ${LEARNING_ANALYTICS_ADVISORY_LOCK.classId},
          ${LEARNING_ANALYTICS_ADVISORY_LOCK.objectId}
        )
      `
      acquired.resolve()
      await release.promise
    },
    { maxWait: 10_000, timeout: 20_000 }
  )

  await acquired.promise
  return {
    release: release.resolve,
    done: transaction,
  }
}

async function expectLearningAnalyticsWriterGateReleased() {
  const result = await prisma.$transaction(async (tx) => {
    return tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(
        ${LEARNING_ANALYTICS_ADVISORY_LOCK.classId},
        ${LEARNING_ANALYTICS_ADVISORY_LOCK.objectId}
      ) AS acquired
    `
  })
  expect(result[0]?.acquired).toBe(true)
}

async function createParticipant(label: string) {
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'integration-test-password',
    },
  })
  fixtureIds.participants.push(participant.id)
  return participant
}

async function createOwner(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-${label}@example.test`,
      shortname: `${TEST_PREFIX}-${label}`,
    },
  })
  fixtureIds.users.push(user.id)
  return user
}

type IndividualAnalyticsValues = {
  activeWeeks: number
  activeDaysPerWeek: number
  meanElementsPerDay: number
  activityLevel: ActivityLevel
  firstErrorRate: number
  firstPerformance: PerformanceLevel
  lastErrorRate: number
  lastPerformance: PerformanceLevel
  totalErrorRate: number
  totalPerformance: PerformanceLevel
  totalScore: number
  completion: number
}

const defaultIndividualAnalyticsValues: IndividualAnalyticsValues = {
  activeWeeks: 1,
  activeDaysPerWeek: 2,
  meanElementsPerDay: 3,
  activityLevel: ActivityLevel.HIGH,
  firstErrorRate: 0.1,
  firstPerformance: PerformanceLevel.LOW,
  lastErrorRate: 0.2,
  lastPerformance: PerformanceLevel.MEDIUM,
  totalErrorRate: 0.15,
  totalPerformance: PerformanceLevel.LOW,
  totalScore: 10,
  completion: 1,
}

async function createIndividualAnalyticsRows({
  courseId,
  participantId,
  practiceQuizId,
  overrides = {},
}: {
  courseId: string
  participantId: string
  practiceQuizId: string
  overrides?: Partial<IndividualAnalyticsValues>
}) {
  const values = { ...defaultIndividualAnalyticsValues, ...overrides }

  await prisma.participantCourseAnalytics.create({
    data: {
      courseId,
      participantId,
      activeWeeks: values.activeWeeks,
      activeDaysPerWeek: values.activeDaysPerWeek,
      meanElementsPerDay: values.meanElementsPerDay,
      activityLevel: values.activityLevel,
    },
  })
  await prisma.participantPerformance.create({
    data: {
      courseId,
      participantId,
      firstErrorRate: values.firstErrorRate,
      firstPerformance: values.firstPerformance,
      lastErrorRate: values.lastErrorRate,
      lastPerformance: values.lastPerformance,
      totalErrorRate: values.totalErrorRate,
      totalPerformance: values.totalPerformance,
    },
  })
  await prisma.participantActivityPerformance.create({
    data: {
      participantId,
      practiceQuizId,
      totalScore: values.totalScore,
      completion: values.completion,
    },
  })
}

async function createCourse(ownerId: string, participantId: string) {
  const startDate = new Date('2026-08-01T00:00:00.000Z')
  const endDate = new Date('2026-09-01T00:00:00.000Z')
  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-course`,
      displayName: `${TEST_PREFIX}-course`,
      startDate,
      endDate,
      groupDeadlineDate: endDate,
      authType: CourseAuthType.SSO,
      isLearningAnalyticsEnabled: true,
      areAnalyticsValid: true,
      participations: {
        create: { participantId },
      },
      ownerId,
    },
  })
  fixtureIds.courses.push(course.id)

  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `${TEST_PREFIX}-practice-quiz`,
      displayName: `${TEST_PREFIX}-practice-quiz`,
      ownerId,
      courseId: course.id,
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

  return { course, practiceQuiz }
}

async function readActivityAnalytics(courseId: string, ctx: ContextWithUser) {
  return getCourseActivityAnalytics({ courseId }, ctx)
}

async function readPerformanceAnalytics(
  courseId: string,
  ctx: ContextWithUser
) {
  return getCoursePerformanceAnalytics({ courseId }, ctx)
}

describe('participant data-use PostgreSQL integration', () => {
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

  it('waits for the global LA lock and records only the current choice', async () => {
    const participant = await createParticipant('exclusive-lock')
    const ctx = participantContext(participant.id)
    const before = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS "now"
    `
    const holder = await holdLearningAnalyticsWriterGate()
    try {
      let settled = false
      const mutation = setLearningAnalyticsConsent({ consent: true }, ctx).then(
        (result) => {
          settled = true
          return result
        }
      )

      await wait(150)
      expect(settled).toBe(false)
      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: null,
      })

      holder.release()
      const result = await mutation
      await holder.done
      const after = await prisma.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp() AS "now"
      `
      expect(result?.learningAnalyticsConsent).toBe(true)
      expect(result?.learningAnalyticsChoiceAt).toBeInstanceOf(Date)
      expect(result?.learningAnalyticsDisclosureVersion).toBe(
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION
      )
      expect(
        result!.learningAnalyticsChoiceAt!.getTime()
      ).toBeGreaterThanOrEqual(before[0]!.now.getTime())
      expect(result!.learningAnalyticsChoiceAt!.getTime()).toBeLessThanOrEqual(
        after[0]!.now.getTime()
      )
      await expectLearningAnalyticsWriterGateReleased()
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
    }
  })

  it('maps a real lock timeout, rolls back, and releases the lock for the next mutation', async () => {
    const participant = await createParticipant('timeout')
    const ctx = participantContext(participant.id)
    const holder = await holdLearningAnalyticsWriterGate()
    try {
      const startedAt = Date.now()

      const timedOut = setLearningAnalyticsConsent({ consent: true }, ctx)
      await expect(timedOut).rejects.toMatchObject({
        extensions: { code: 'PARTICIPANT_DATA_USE_LOCK_TIMEOUT' },
      })
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(4_500)

      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: null,
        learningAnalyticsDisclosureVersion: null,
      })

      holder.release()
      await holder.done
      await expect(
        setLearningAnalyticsConsent({ consent: true }, ctx)
      ).resolves.toMatchObject({
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: expect.any(Date),
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
    }
  }, 15_000)

  it('updates research consent while the learning-analytics lock is held', async () => {
    const participant = await createParticipant('research-while-locked')
    const ctx = participantContext(participant.id)
    const holder = await holdLearningAnalyticsWriterGate()
    let researchMutation: ReturnType<typeof setResearchConsent> | undefined
    try {
      researchMutation = setResearchConsent({ consent: true }, ctx)
      const result = await Promise.race([
        researchMutation,
        wait(1_000).then(() => null),
      ])

      expect(result).not.toBeNull()
      expect(result).toMatchObject({
        researchConsent: true,
        researchConsentChoiceAt: expect.any(Date),
        researchConsentDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })
      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
      })

      holder.release()
      await holder.done
      await researchMutation
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
      await researchMutation?.catch(() => undefined)
    }
  }, 10_000)

  it('rejects malformed enablement and repairs withdrawal while releasing the writer lock', async () => {
    const participant = await createParticipant('incomplete-metadata')
    const ctx = participantContext(participant.id)
    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: null,
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      },
    })

    await expect(
      setLearningAnalyticsConsent({ consent: true }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_MALFORMED_STATE' },
    })
    await expectLearningAnalyticsWriterGateReleased()
    await expect(
      setLearningAnalyticsConsent({ consent: false }, ctx)
    ).resolves.toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: expect.any(Date),
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
  })

  it('keeps analytics hidden until computation is strictly newer than the current choice', async () => {
    const owner = await createOwner('strict-freshness')
    const participant = await createParticipant('strict-freshness')
    const ctx = participantContext(participant.id)
    const { course, practiceQuiz } = await createCourse(
      owner.id,
      participant.id
    )
    const enabled = await setLearningAnalyticsConsent({ consent: true }, ctx)
    const choiceAt = enabled!.learningAnalyticsChoiceAt!
    await createIndividualAnalyticsRows({
      courseId: course.id,
      participantId: participant.id,
      practiceQuizId: practiceQuiz.id,
    })

    await prisma.course.update({
      where: { id: course.id },
      data: { analyticsLastComputedAt: choiceAt },
    })
    const equalActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    const equalPerformance = await getCoursePerformanceAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(equalActivity?.participantCourseAnalytics).toHaveLength(0)
    expect(equalActivity?.dailyActivity).toHaveLength(1)
    expect(equalPerformance?.participantPerformances).toHaveLength(0)
    expect(equalPerformance?.participantActivityPerformances).toHaveLength(0)

    await prisma.course.update({
      where: { id: course.id },
      data: { analyticsLastComputedAt: new Date(choiceAt.getTime() + 1) },
    })
    const freshActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    const freshPerformance = await getCoursePerformanceAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(freshActivity?.participantCourseAnalytics).toHaveLength(1)
    expect(freshPerformance?.participantPerformances).toHaveLength(1)
    expect(freshPerformance?.participantActivityPerformances).toHaveLength(1)

    await setLearningAnalyticsConsent({ consent: false }, ctx)
    const withdrawnActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(withdrawnActivity?.participantCourseAnalytics).toHaveLength(0)
    expect(withdrawnActivity?.dailyActivity).toHaveLength(1)

    await new Promise((resolve) => setTimeout(resolve, 10))
    const reenabled = await setLearningAnalyticsConsent({ consent: true }, ctx)
    const reenabledChoiceAt = reenabled!.learningAnalyticsChoiceAt!
    const staleActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(staleActivity?.participantCourseAnalytics).toHaveLength(0)

    await prisma.course.update({
      where: { id: course.id },
      data: {
        analyticsLastComputedAt: new Date(reenabledChoiceAt.getTime() + 1),
      },
    })
    const recomputedActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(recomputedActivity?.participantCourseAnalytics).toHaveLength(1)
  })

  it('requires complete current choice metadata and preserves aggregate output', async () => {
    const owner = await createOwner('metadata')
    const participant = await createParticipant('metadata')
    const ctx = participantContext(participant.id)
    const { course, practiceQuiz } = await createCourse(
      owner.id,
      participant.id
    )
    const enabled = await setLearningAnalyticsConsent({ consent: true }, ctx)
    const choiceAt = enabled!.learningAnalyticsChoiceAt!
    await createIndividualAnalyticsRows({
      courseId: course.id,
      participantId: participant.id,
      practiceQuizId: practiceQuiz.id,
    })
    await prisma.course.update({
      where: { id: course.id },
      data: { analyticsLastComputedAt: new Date(choiceAt.getTime() + 1) },
    })

    await prisma.participant.update({
      where: { id: participant.id },
      data: { learningAnalyticsDisclosureVersion: '   ' },
    })
    const result = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(result?.participantCourseAnalytics).toHaveLength(0)
    expect(result?.dailyActivity).toHaveLength(1)

    await expect(
      setResearchConsent({ consent: true }, ctx)
    ).resolves.toMatchObject({
      researchConsent: true,
      researchConsentChoiceAt: expect.any(Date),
      researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
    await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
      researchConsent: true,
      learningAnalyticsConsent: true,
    })
  })

  it('preserves aggregate output across withdrawal and re-enable', async () => {
    const owner = await createOwner('aggregate-reenable')
    const participant = await createParticipant('aggregate-reenable')
    const ctx = participantContext(participant.id)
    const { course, practiceQuiz } = await createCourse(
      owner.id,
      participant.id
    )
    const initial = await setLearningAnalyticsConsent({ consent: true }, ctx)
    const initialChoiceAt = initial!.learningAnalyticsChoiceAt!
    await createIndividualAnalyticsRows({
      courseId: course.id,
      participantId: participant.id,
      practiceQuizId: practiceQuiz.id,
    })
    await prisma.course.update({
      where: { id: course.id },
      data: {
        analyticsLastComputedAt: new Date(initialChoiceAt.getTime() + 1),
      },
    })
    const initiallyVisibleActivity = await readActivityAnalytics(course.id, ctx)
    const initiallyVisiblePerformance = await readPerformanceAnalytics(
      course.id,
      ctx
    )
    expect(initiallyVisibleActivity?.participantCourseAnalytics).toHaveLength(1)
    expect(initiallyVisibleActivity?.dailyActivity).toHaveLength(1)
    expect(initiallyVisiblePerformance?.participantPerformances).toHaveLength(1)
    expect(
      initiallyVisiblePerformance?.participantActivityPerformances
    ).toHaveLength(1)

    const initialActivityAggregates = {
      totalParticipants: initiallyVisibleActivity!.totalParticipants,
      dailyActivity: initiallyVisibleActivity!.dailyActivity,
      weeklyActivity: initiallyVisibleActivity!.weeklyActivity,
      activeDays: initiallyVisibleActivity!.activeDays,
    }
    const initialPerformanceAggregates = {
      totalParticipants: initiallyVisiblePerformance!.totalParticipants,
      activityProgresses: initiallyVisiblePerformance!.activityProgresses,
      activityPerformances: initiallyVisiblePerformance!.activityPerformances,
      instancePerformances: initiallyVisiblePerformance!.instancePerformances,
      instanceFeedbacks: initiallyVisiblePerformance!.instanceFeedbacks,
      activityFeedbacks: initiallyVisiblePerformance!.activityFeedbacks,
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: { learningAnalyticsDisclosureVersion: 'legacy-v0' },
    })
    const legacyDisclosureActivity = await readActivityAnalytics(course.id, ctx)
    const legacyDisclosurePerformance = await readPerformanceAnalytics(
      course.id,
      ctx
    )
    expect(legacyDisclosureActivity?.participantCourseAnalytics).toHaveLength(1)
    expect(legacyDisclosurePerformance?.participantPerformances).toHaveLength(1)
    expect(
      legacyDisclosurePerformance?.participantActivityPerformances
    ).toHaveLength(1)

    await prisma.participant.update({
      where: { id: participant.id },
      data: { learningAnalyticsDisclosureVersion: '   ' },
    })
    const blankDisclosureActivity = await readActivityAnalytics(course.id, ctx)
    const blankDisclosurePerformance = await readPerformanceAnalytics(
      course.id,
      ctx
    )
    expect(blankDisclosureActivity?.participantCourseAnalytics).toHaveLength(0)
    expect(blankDisclosureActivity?.dailyActivity).toHaveLength(1)
    expect(blankDisclosurePerformance?.participantPerformances).toHaveLength(0)
    expect(
      blankDisclosurePerformance?.participantActivityPerformances
    ).toHaveLength(0)
    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      },
    })

    await setLearningAnalyticsConsent({ consent: false }, ctx)
    const withdrawnActivity = await readActivityAnalytics(course.id, ctx)
    const withdrawnPerformance = await readPerformanceAnalytics(course.id, ctx)
    expect(withdrawnActivity?.participantCourseAnalytics).toHaveLength(0)
    expect(withdrawnActivity?.dailyActivity).toHaveLength(1)
    expect(withdrawnPerformance?.participantPerformances).toHaveLength(0)
    expect(withdrawnPerformance?.participantActivityPerformances).toHaveLength(
      0
    )
    expect({
      totalParticipants: withdrawnActivity!.totalParticipants,
      dailyActivity: withdrawnActivity!.dailyActivity,
      weeklyActivity: withdrawnActivity!.weeklyActivity,
      activeDays: withdrawnActivity!.activeDays,
    }).toEqual(initialActivityAggregates)
    expect({
      totalParticipants: withdrawnPerformance!.totalParticipants,
      activityProgresses: withdrawnPerformance!.activityProgresses,
      activityPerformances: withdrawnPerformance!.activityPerformances,
      instancePerformances: withdrawnPerformance!.instancePerformances,
      instanceFeedbacks: withdrawnPerformance!.instanceFeedbacks,
      activityFeedbacks: withdrawnPerformance!.activityFeedbacks,
    }).toEqual(initialPerformanceAggregates)

    await wait(10)
    const reenabled = await setLearningAnalyticsConsent({ consent: true }, ctx)
    const reenabledChoiceAt = reenabled!.learningAnalyticsChoiceAt!
    expect(reenabledChoiceAt.getTime()).toBeGreaterThan(
      initialChoiceAt.getTime()
    )

    const beforeRecomputeActivity = await readActivityAnalytics(course.id, ctx)
    const beforeRecomputePerformance = await readPerformanceAnalytics(
      course.id,
      ctx
    )
    expect(beforeRecomputeActivity?.participantCourseAnalytics).toHaveLength(0)
    expect(beforeRecomputeActivity?.dailyActivity).toHaveLength(1)
    expect(beforeRecomputePerformance?.participantPerformances).toHaveLength(0)
    expect(
      beforeRecomputePerformance?.participantActivityPerformances
    ).toHaveLength(0)
    expect({
      totalParticipants: beforeRecomputeActivity!.totalParticipants,
      dailyActivity: beforeRecomputeActivity!.dailyActivity,
      weeklyActivity: beforeRecomputeActivity!.weeklyActivity,
      activeDays: beforeRecomputeActivity!.activeDays,
    }).toEqual(initialActivityAggregates)
    expect({
      totalParticipants: beforeRecomputePerformance!.totalParticipants,
      activityProgresses: beforeRecomputePerformance!.activityProgresses,
      activityPerformances: beforeRecomputePerformance!.activityPerformances,
      instancePerformances: beforeRecomputePerformance!.instancePerformances,
      instanceFeedbacks: beforeRecomputePerformance!.instanceFeedbacks,
      activityFeedbacks: beforeRecomputePerformance!.activityFeedbacks,
    }).toEqual(initialPerformanceAggregates)

    // The writer must clean up rows from the previous consent window before
    // publishing replacement rows and advancing the recomputation marker.
    await prisma.participantCourseAnalytics.deleteMany({
      where: { courseId: course.id, participantId: participant.id },
    })
    await prisma.participantPerformance.deleteMany({
      where: { courseId: course.id, participantId: participant.id },
    })
    await prisma.participantActivityPerformance.deleteMany({
      where: { participantId: participant.id, practiceQuizId: practiceQuiz.id },
    })
    await createIndividualAnalyticsRows({
      courseId: course.id,
      participantId: participant.id,
      practiceQuizId: practiceQuiz.id,
      overrides: {
        activeWeeks: 9,
        activeDaysPerWeek: 8,
        meanElementsPerDay: 7,
        activityLevel: ActivityLevel.LOW,
        firstErrorRate: 0.9,
        firstPerformance: PerformanceLevel.HIGH,
        lastErrorRate: 0.8,
        lastPerformance: PerformanceLevel.HIGH,
        totalErrorRate: 0.85,
        totalPerformance: PerformanceLevel.MEDIUM,
        totalScore: 99,
        completion: 0.5,
      },
    })
    await prisma.course.update({
      where: { id: course.id },
      data: {
        analyticsLastComputedAt: new Date(reenabledChoiceAt.getTime() + 1_000),
      },
    })
    const recomputedActivity = await readActivityAnalytics(course.id, ctx)
    const recomputedPerformance = await readPerformanceAnalytics(course.id, ctx)
    expect(recomputedActivity?.participantCourseAnalytics).toHaveLength(1)
    expect(recomputedActivity?.dailyActivity).toHaveLength(1)
    expect(recomputedActivity?.participantCourseAnalytics[0]).toMatchObject({
      activeWeeks: 9,
      activeDaysPerWeek: 8,
      meanElementsPerDay: 7,
      activityLevel: ActivityLevel.LOW,
    })
    expect(recomputedPerformance?.participantPerformances).toHaveLength(1)
    expect(recomputedPerformance?.participantActivityPerformances).toHaveLength(
      1
    )
    expect(recomputedPerformance?.participantPerformances[0]).toMatchObject({
      firstErrorRate: 0.9,
      firstPerformance: PerformanceLevel.HIGH,
      lastErrorRate: 0.8,
      lastPerformance: PerformanceLevel.HIGH,
      totalErrorRate: 0.85,
      totalPerformance: PerformanceLevel.MEDIUM,
    })
    expect(
      recomputedPerformance?.participantActivityPerformances[0]
        ?.activityPerformances[0]
    ).toMatchObject({ totalScore: 99, completion: 0.5 })
    expect({
      totalParticipants: recomputedActivity!.totalParticipants,
      dailyActivity: recomputedActivity!.dailyActivity,
      weeklyActivity: recomputedActivity!.weeklyActivity,
      activeDays: recomputedActivity!.activeDays,
    }).toEqual(initialActivityAggregates)
    expect({
      totalParticipants: recomputedPerformance!.totalParticipants,
      activityProgresses: recomputedPerformance!.activityProgresses,
      activityPerformances: recomputedPerformance!.activityPerformances,
      instancePerformances: recomputedPerformance!.instancePerformances,
      instanceFeedbacks: recomputedPerformance!.instanceFeedbacks,
      activityFeedbacks: recomputedPerformance!.activityFeedbacks,
    }).toEqual(initialPerformanceAggregates)

    await setLearningAnalyticsConsent({ consent: false }, ctx)
    const withdrawnAgainActivity = await readActivityAnalytics(course.id, ctx)
    const withdrawnAgainPerformance = await readPerformanceAnalytics(
      course.id,
      ctx
    )
    expect(withdrawnAgainActivity?.participantCourseAnalytics).toHaveLength(0)
    expect(withdrawnAgainActivity?.dailyActivity).toHaveLength(1)
    expect(withdrawnAgainPerformance?.participantPerformances).toHaveLength(0)
    expect(
      withdrawnAgainPerformance?.participantActivityPerformances
    ).toHaveLength(0)
  }, 15_000)
})
