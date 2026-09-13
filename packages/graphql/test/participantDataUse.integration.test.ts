import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
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
import { completeParticipantDataUse } from '../src/services/participantAccountDataUse.js'
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
    featureFlags: { isEnabled: (key: string) => key === 'learning-analytics' },
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function choiceInput(consent: boolean, expectedRevision: number) {
  return {
    consent,
    expectedRevision,
    disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  }
}

async function completeParticipant(
  participantId: string,
  choices: {
    researchConsent?: boolean
    learningAnalyticsConsent?: boolean
  } = {}
) {
  await requireDisposableDatabase(prisma)
  return completeParticipantDataUse(
    {
      expectedRevision: 0,
      disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      researchConsent: choices.researchConsent ?? false,
      learningAnalyticsConsent: choices.learningAnalyticsConsent ?? false,
      acknowledged: true,
    },
    participantContext(participantId)
  )
}

const completedRevision = 1

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
  await requireDisposableDatabase(prisma)
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
  await requireDisposableDatabase(prisma)
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
  await requireDisposableDatabase(prisma)
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
  await requireDisposableDatabase(prisma)
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
  await requireDisposableDatabase(prisma)
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
  await requireDisposableDatabase(prisma)
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

describe('participant data-use PostgreSQL integration', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$connect()
  })

  afterEach(async () => {
    await requireDisposableDatabase(prisma)
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
    await requireDisposableDatabase(prisma)
    await prisma.$disconnect()
  })

  it('waits for the global LA lock and records only the current choice', async () => {
    const participant = await createParticipant('exclusive-lock')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id)
    const before = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS "now"
    `
    const holder = await holdLearningAnalyticsWriterGate()
    try {
      let settled = false
      const mutation = setLearningAnalyticsConsent(
        choiceInput(true, completedRevision),
        ctx
      ).then((result) => {
        settled = true
        return result
      })

      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(settled).toBe(false)
      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: expect.any(Date),
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })

      holder.release()
      const result = await mutation
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
      await holder.done
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
    }
  })

  it('maps a real lock timeout, rolls back, and releases the lock for the next mutation', async () => {
    const participant = await createParticipant('timeout')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id)
    const holder = await holdLearningAnalyticsWriterGate()
    try {
      const startedAt = Date.now()

      const timedOut = setLearningAnalyticsConsent(
        choiceInput(true, completedRevision),
        ctx
      )
      await expect(timedOut).rejects.toMatchObject({
        extensions: { code: 'PARTICIPANT_DATA_USE_LOCK_TIMEOUT' },
      })
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(4_500)

      await expect(getParticipantDataUse(ctx)).resolves.toMatchObject({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: expect.any(Date),
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      })

      holder.release()
      await holder.done
      await expect(
        setLearningAnalyticsConsent(choiceInput(true, completedRevision), ctx)
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
    await completeParticipant(participant.id)
    const holder = await holdLearningAnalyticsWriterGate()
    let researchMutation: ReturnType<typeof setResearchConsent> | undefined
    try {
      researchMutation = setResearchConsent(
        choiceInput(true, completedRevision),
        ctx
      )
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

  it('repairs incomplete current metadata only through completion', async () => {
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
      setLearningAnalyticsConsent(choiceInput(true, 0), ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' },
    })
    await expectLearningAnalyticsWriterGateReleased()

    await expect(
      completeParticipantDataUse(
        {
          expectedRevision: 0,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
          researchConsent: false,
          learningAnalyticsConsent: true,
          acknowledged: true,
        },
        ctx
      )
    ).resolves.toMatchObject({
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: expect.any(Date),
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseRevision: 1,
    })
    await expectLearningAnalyticsWriterGateReleased()
  })

  it('keeps analytics hidden until computation is strictly newer than the current choice', async () => {
    const owner = await createOwner('strict-freshness')
    const participant = await createParticipant('strict-freshness')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id)
    const { course, practiceQuiz } = await createCourse(
      owner.id,
      participant.id
    )
    const enabled = await setLearningAnalyticsConsent(
      choiceInput(true, completedRevision),
      ctx
    )
    const choiceAt = enabled!.learningAnalyticsChoiceAt!
    await createIndividualAnalyticsRows({
      courseId: course.id,
      participantId: participant.id,
      practiceQuizId: practiceQuiz.id,
    })

    await prisma.course.update({
      where: { id: course.id },
      data: { areAnalyticsValid: true, analyticsLastComputedAt: choiceAt },
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
      data: {
        areAnalyticsValid: true,
        analyticsLastComputedAt: new Date(choiceAt.getTime() + 1),
      },
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

    const withdrawn = await setLearningAnalyticsConsent(
      choiceInput(false, completedRevision + 1),
      ctx
    )
    expect(withdrawn?.learningAnalyticsConsent).toBe(false)
    const withdrawnActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(withdrawnActivity).toBeNull()

    const reenabled = await setLearningAnalyticsConsent(
      choiceInput(true, completedRevision + 2),
      ctx
    )
    const reenabledChoiceAt = reenabled!.learningAnalyticsChoiceAt!
    const staleActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(staleActivity).toBeNull()

    await prisma.course.update({
      where: { id: course.id },
      data: {
        analyticsLastComputedAt: new Date(reenabledChoiceAt.getTime() + 1),
      },
    })
    const timestampOnlyActivity = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(timestampOnlyActivity).toBeNull()
  })

  it('requires complete current choice metadata and preserves aggregate output', async () => {
    const owner = await createOwner('metadata')
    const participant = await createParticipant('metadata')
    const ctx = participantContext(participant.id)
    await completeParticipant(participant.id)
    const { course, practiceQuiz } = await createCourse(
      owner.id,
      participant.id
    )
    const enabled = await setLearningAnalyticsConsent(
      choiceInput(true, completedRevision),
      ctx
    )
    const choiceAt = enabled!.learningAnalyticsChoiceAt!
    await createIndividualAnalyticsRows({
      courseId: course.id,
      participantId: participant.id,
      practiceQuizId: practiceQuiz.id,
    })
    await prisma.course.update({
      where: { id: course.id },
      data: {
        areAnalyticsValid: true,
        analyticsLastComputedAt: new Date(choiceAt.getTime() + 1),
      },
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
  })
})
