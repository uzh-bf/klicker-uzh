import { randomUUID } from 'node:crypto'

import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import {
  ActivityLevel,
  AnalyticsType,
  ChatDoseBucket,
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PerformanceLevel,
  PointCorrectionType,
  type PrismaClient,
  ResponseCorrectness,
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
  handleParticipantAnalyticsWithdrawals,
  processParticipantAnalyticsWithdrawal,
} from '../src/services/participantAnalyticsWithdrawal.js'
import { setLearningAnalyticsConsent } from '../src/services/participants.js'

const TEST_PREFIX = `participant-analytics-withdrawal-${Date.now()}-${randomUUID()}`
const WITHDRAWAL_REVISION = 2
const ANALYTICS_TIMESTAMP = new Date('2026-09-01T00:00:00.000Z')

const fixtureIds = {
  courses: [] as string[],
  participants: [] as string[],
  users: [] as string[],
}

type Fixture = {
  participantId: string
  ownerId: string
  courseId: string
  participationId: number
  practiceQuizId: string
  chatbotId: string
  liveQuizId: string
  competencyId: number
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

async function createFixture(
  label: string,
  options: { learningAnalyticsConsent?: boolean } = {}
): Promise<Fixture> {
  await requireDisposableDatabase(prisma)

  const owner = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-${label}@example.invalid`,
      shortname: `${TEST_PREFIX}-${label}`,
    },
  })
  fixtureIds.users.push(owner.id)

  const choiceAt = new Date('2026-08-31T12:00:00.000Z')
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'synthetic-integration-password',
      researchConsent: false,
      researchConsentChoiceAt: choiceAt,
      researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsConsent: options.learningAnalyticsConsent ?? false,
      learningAnalyticsChoiceAt: choiceAt,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseAcknowledgedAt: choiceAt,
      dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseRevision: WITHDRAWAL_REVISION,
    },
  })
  fixtureIds.participants.push(participant.id)

  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-${label}-course`,
      displayName: `${TEST_PREFIX}-${label}-course`,
      ownerId: owner.id,
      authType: CourseAuthType.SSO,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T00:00:00.000Z'),
      groupDeadlineDate: new Date('2026-09-30T00:00:00.000Z'),
    },
  })
  fixtureIds.courses.push(course.id)

  const participation = await prisma.participation.create({
    data: {
      participantId: participant.id,
      courseId: course.id,
      isActive: true,
    },
  })

  const practiceQuiz = await prisma.practiceQuiz.create({
    data: {
      name: `${TEST_PREFIX}-${label}-practice`,
      displayName: `${TEST_PREFIX}-${label}-practice`,
      ownerId: owner.id,
      courseId: course.id,
    },
  })

  const chatbot = await prisma.chatbot.create({
    data: {
      name: `${TEST_PREFIX}-${label}-chatbot`,
      ownerId: owner.id,
      courseId: course.id,
    },
  })

  const liveQuiz = await prisma.liveQuiz.create({
    data: {
      name: `${TEST_PREFIX}-${label}-live`,
      displayName: `${TEST_PREFIX}-${label}-live`,
      ownerId: owner.id,
      courseId: course.id,
    },
  })

  const competencyTree = await prisma.competencyTree.create({
    data: {
      name: `${TEST_PREFIX}-${label}-tree`,
      ownerId: owner.id,
    },
  })
  const competency = await prisma.competency.create({
    data: {
      name: `${TEST_PREFIX}-${label}-competency`,
      lft: 1,
      rgt: 2,
      treeId: competencyTree.id,
    },
  })

  const element = await prisma.element.create({
    data: {
      ownerId: owner.id,
      name: `${TEST_PREFIX}-${label}-element`,
      content: 'Synthetic response content',
      type: ElementType.SC,
      options: { choices: [] },
    },
  })
  const stack = await prisma.elementStack.create({
    data: {
      type: ElementStackType.PRACTICE_QUIZ,
      order: 0,
      practiceQuizId: practiceQuiz.id,
      courseId: course.id,
    },
  })
  const instance = await prisma.elementInstance.create({
    data: {
      ownerId: owner.id,
      elementId: element.id,
      elementStackId: stack.id,
      type: ElementInstanceType.PRACTICE_QUIZ,
      elementType: ElementType.SC,
      order: 0,
      options: {},
      elementData: {} as any,
      results: {} as any,
      anonymousResults: {} as any,
    },
  })

  await prisma.questionResponse.create({
    data: {
      participantId: participant.id,
      participationId: participation.id,
      elementInstanceId: instance.id,
      practiceQuizId: practiceQuiz.id,
      courseId: course.id,
      averageTimeSpent: 1,
      firstResponse: {} as any,
      firstResponseCorrectness: ResponseCorrectness.CORRECT,
      lastResponse: {} as any,
      lastResponseCorrectness: ResponseCorrectness.CORRECT,
    },
  })
  await prisma.questionResponseDetail.create({
    data: {
      participantId: participant.id,
      participationId: participation.id,
      elementInstanceId: instance.id,
      practiceQuizId: practiceQuiz.id,
      response: {} as any,
      timeSpent: 1,
    },
  })
  await prisma.pointCorrection.create({
    data: {
      type: PointCorrectionType.SINGLE,
      participantId: participant.id,
      liveQuizId: liveQuiz.id,
      basePoints: true,
      reason: 'Synthetic correction',
      studentReason: 'Synthetic correction',
    },
  })

  return {
    participantId: participant.id,
    ownerId: owner.id,
    courseId: course.id,
    participationId: participation.id,
    practiceQuizId: practiceQuiz.id,
    chatbotId: chatbot.id,
    liveQuizId: liveQuiz.id,
    competencyId: competency.id,
  }
}

async function createAnalyticsData(
  fixture: Fixture,
  timestamp = ANALYTICS_TIMESTAMP
) {
  await requireDisposableDatabase(prisma)

  await prisma.participantAnalytics.create({
    data: {
      participantId: fixture.participantId,
      courseId: fixture.courseId,
      type: AnalyticsType.COURSE,
      timestamp,
      trialsCount: 1,
      responseCount: 1,
      totalScore: 1,
      totalPoints: 1,
      totalXp: 1,
      meanCorrectCount: 1,
      meanPartialCorrectCount: 0,
      meanWrongCount: 0,
      competencyAnalytics: {
        create: {
          competencyId: fixture.competencyId,
          unsolvedQuestionsCount: 0,
          lastCorrectCount: 1,
          lastPartialCorrectCount: 0,
          lastWrongCount: 0,
        },
      },
    },
  })
  await prisma.participantCourseAnalytics.create({
    data: {
      participantId: fixture.participantId,
      courseId: fixture.courseId,
      activeWeeks: 1,
      activeDaysPerWeek: 1,
      meanElementsPerDay: 1,
      activityLevel: ActivityLevel.HIGH,
    },
  })
  await prisma.participantPerformance.create({
    data: {
      participantId: fixture.participantId,
      courseId: fixture.courseId,
      firstErrorRate: 0,
      firstPerformance: PerformanceLevel.HIGH,
      lastErrorRate: 0,
      lastPerformance: PerformanceLevel.HIGH,
      totalErrorRate: 0,
      totalPerformance: PerformanceLevel.HIGH,
    },
  })
  await prisma.participantActivityPerformance.create({
    data: {
      participantId: fixture.participantId,
      practiceQuizId: fixture.practiceQuizId,
      totalScore: 1,
      completion: 1,
    },
  })
  await prisma.participantChatAnalytics.create({
    data: {
      participantId: fixture.participantId,
      chatbotId: fixture.chatbotId,
      type: AnalyticsType.DAILY,
      timestamp,
    },
  })
  await prisma.participantChatOutcome.create({
    data: {
      participantId: fixture.participantId,
      courseId: fixture.courseId,
      chatDoseBucket: ChatDoseBucket.LOW,
    },
  })
  await prisma.participantLiveQuizAnalytics.create({
    data: {
      participantId: fixture.participantId,
      liveQuizId: fixture.liveQuizId,
    },
  })
}

async function readAnalyticsCounts(participantId: string) {
  await requireDisposableDatabase(prisma)
  const analytics = await prisma.participantAnalytics.findMany({
    where: { participantId },
    select: { id: true },
  })
  const [course, performance, activity, chat, outcome, liveQuiz, competency] =
    await Promise.all([
      prisma.participantCourseAnalytics.count({ where: { participantId } }),
      prisma.participantPerformance.count({ where: { participantId } }),
      prisma.participantActivityPerformance.count({
        where: { participantId },
      }),
      prisma.participantChatAnalytics.count({ where: { participantId } }),
      prisma.participantChatOutcome.count({ where: { participantId } }),
      prisma.participantLiveQuizAnalytics.count({ where: { participantId } }),
      prisma.competencyAnalytics.count({
        where: {
          participantAnalyticsId: { in: analytics.map(({ id }) => id) },
        },
      }),
    ])

  return {
    participant: analytics.length,
    competency,
    course,
    performance,
    activity,
    chat,
    outcome,
    liveQuiz,
  }
}

async function readRetainedCounts(fixture: Fixture) {
  await requireDisposableDatabase(prisma)
  const [participation, responses, responseDetails, pointCorrections] =
    await Promise.all([
      prisma.participation.count({ where: { id: fixture.participationId } }),
      prisma.questionResponse.count({
        where: { participantId: fixture.participantId },
      }),
      prisma.questionResponseDetail.count({
        where: { participantId: fixture.participantId },
      }),
      prisma.pointCorrection.count({
        where: { participantId: fixture.participantId },
      }),
    ])

  return { participation, responses, responseDetails, pointCorrections }
}

async function createWithdrawal(
  fixture: Fixture,
  options: { requestedAt?: Date; completedAt?: Date } = {}
) {
  await requireDisposableDatabase(prisma)
  const requestedAt = options.requestedAt ?? new Date()

  await prisma.participantDataUseEvent.create({
    data: {
      participantId: fixture.participantId,
      revision: WITHDRAWAL_REVISION,
      disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      researchConsent: false,
      learningAnalyticsConsent: false,
      acknowledged: true,
    },
  })

  return prisma.participantAnalyticsWithdrawal.create({
    data: {
      participantId: fixture.participantId,
      withdrawalRevision: WITHDRAWAL_REVISION,
      requestedAt,
      completedAt: options.completedAt,
    },
  })
}

async function readWithdrawal(
  fixture: Fixture,
  withdrawalRevision = WITHDRAWAL_REVISION
) {
  await requireDisposableDatabase(prisma)
  return prisma.participantAnalyticsWithdrawal.findUnique({
    where: {
      participantId_withdrawalRevision: {
        participantId: fixture.participantId,
        withdrawalRevision,
      },
    },
    include: { choiceEvent: true },
  })
}

async function cleanupFixtures() {
  await requireDisposableDatabase(prisma)
  if (fixtureIds.participants.length > 0) {
    await prisma.pointCorrection.deleteMany({
      where: { participantId: { in: fixtureIds.participants } },
    })
    await prisma.participant.deleteMany({
      where: { id: { in: fixtureIds.participants } },
    })
  }
  if (fixtureIds.courses.length > 0) {
    await prisma.course.deleteMany({
      where: { id: { in: fixtureIds.courses } },
    })
  }
  if (fixtureIds.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: fixtureIds.users } } })
  }
  fixtureIds.courses.length = 0
  fixtureIds.participants.length = 0
  fixtureIds.users.length = 0
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function holdSharedAnalyticsLock() {
  await requireDisposableDatabase(prisma)
  const acquired = deferred()
  const release = deferred()
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
  return { release: release.resolve, done: transaction }
}

describe('participant analytics withdrawal PostgreSQL integration', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$connect()
  })

  afterEach(async () => {
    await cleanupFixtures()
  })

  afterAll(async () => {
    await cleanupFixtures()
    await prisma.$disconnect()
  })

  it('deletes participant analytics and retains raw responses, points, and membership', async () => {
    const fixture = await createFixture('cleanup')
    const request = await createWithdrawal(fixture, {
      requestedAt: new Date('2026-08-31T00:00:00.000Z'),
    })
    await createAnalyticsData(fixture)

    await expect(
      processParticipantAnalyticsWithdrawal(fixture.participantId, prisma)
    ).resolves.toBe(1)

    expect(await readAnalyticsCounts(fixture.participantId)).toEqual({
      participant: 0,
      competency: 0,
      course: 0,
      performance: 0,
      activity: 0,
      chat: 0,
      outcome: 0,
      liveQuiz: 0,
    })
    expect(await readRetainedCounts(fixture)).toEqual({
      participation: 1,
      responses: 1,
      responseDetails: 1,
      pointCorrections: 1,
    })
    expect(
      await prisma.participant.findUnique({
        where: { id: fixture.participantId },
      })
    ).not.toBeNull()

    const completed = await readWithdrawal(fixture)
    expect(completed).toMatchObject({
      participantId: fixture.participantId,
      withdrawalRevision: WITHDRAWAL_REVISION,
      requestedAt: request.requestedAt,
      completedAt: expect.any(Date),
      choiceEvent: {
        participantId: fixture.participantId,
        revision: WITHDRAWAL_REVISION,
        learningAnalyticsConsent: false,
      },
    })
    expect(completed!.completedAt!.getTime()).toBeGreaterThanOrEqual(
      request.requestedAt.getTime()
    )
  })

  it('records a revisioned withdrawal before deleting analytics', async () => {
    const fixture = await createFixture('revisioned-withdrawal', {
      learningAnalyticsConsent: true,
    })
    await createAnalyticsData(fixture)
    await prisma.course.update({
      where: { id: fixture.courseId },
      data: {
        areAnalyticsValid: true,
        analyticsLastComputedAt: ANALYTICS_TIMESTAMP,
      },
    })
    const generationBefore =
      await prisma.analyticsEligibilityGeneration.findUnique({
        where: { id: 0 },
      })
    const withdrawalRevision = WITHDRAWAL_REVISION + 1

    await expect(
      setLearningAnalyticsConsent(
        {
          consent: false,
          expectedRevision: WITHDRAWAL_REVISION,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        },
        participantContext(fixture.participantId)
      )
    ).resolves.toMatchObject({
      learningAnalyticsConsent: false,
      dataUseRevision: withdrawalRevision,
    })

    const pending = await readWithdrawal(fixture, withdrawalRevision)
    expect(pending).toMatchObject({
      participantId: fixture.participantId,
      withdrawalRevision,
      requestedAt: expect.any(Date),
      completedAt: null,
      choiceEvent: {
        participantId: fixture.participantId,
        revision: withdrawalRevision,
        disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        researchConsent: false,
        learningAnalyticsConsent: false,
        acknowledged: true,
      },
    })
    expect(pending).not.toBeNull()

    const generationAfter =
      await prisma.analyticsEligibilityGeneration.findUniqueOrThrow({
        where: { id: 0 },
      })
    expect(generationAfter.generation).toBe(
      (generationBefore?.generation ?? 0n) + 1n
    )
    expect(
      await prisma.course.findUniqueOrThrow({
        where: { id: fixture.courseId },
        select: { areAnalyticsValid: true, analyticsLastComputedAt: true },
      })
    ).toEqual({ areAnalyticsValid: false, analyticsLastComputedAt: null })

    await expect(
      processParticipantAnalyticsWithdrawal(fixture.participantId, prisma)
    ).resolves.toBe(1)
    expect(await readAnalyticsCounts(fixture.participantId)).toEqual({
      participant: 0,
      competency: 0,
      course: 0,
      performance: 0,
      activity: 0,
      chat: 0,
      outcome: 0,
      liveQuiz: 0,
    })
    expect(await readRetainedCounts(fixture)).toEqual({
      participation: 1,
      responses: 1,
      responseDetails: 1,
      pointCorrections: 1,
    })

    const completed = await readWithdrawal(fixture, withdrawalRevision)
    expect(completed).toMatchObject({ completedAt: expect.any(Date) })
    expect(completed?.choiceEvent).toEqual(pending?.choiceEvent)
  })

  it('waits for the shared analytics lock before completing cleanup', async () => {
    const fixture = await createFixture('lock')
    await createWithdrawal(fixture)
    await createAnalyticsData(fixture)
    const holder = await holdSharedAnalyticsLock()
    let settled = false
    const processing = processParticipantAnalyticsWithdrawal(
      fixture.participantId,
      prisma
    ).then((result) => {
      settled = true
      return result
    })

    try {
      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(settled).toBe(false)
      holder.release()
      await expect(processing).resolves.toBe(1)
    } finally {
      holder.release()
      await holder.done.catch(() => undefined)
    }
  })

  it('does not delete analytics published after a completed duplicate request', async () => {
    const fixture = await createFixture('duplicate')
    await createWithdrawal(fixture, {
      completedAt: new Date('2026-09-02T00:00:00.000Z'),
    })
    await createAnalyticsData(fixture, new Date('2026-09-03T00:00:00.000Z'))

    await expect(
      processParticipantAnalyticsWithdrawal(fixture.participantId, prisma)
    ).resolves.toBe(0)
    expect(await readAnalyticsCounts(fixture.participantId)).toEqual({
      participant: 1,
      competency: 1,
      course: 1,
      performance: 1,
      activity: 1,
      chat: 1,
      outcome: 1,
      liveQuiz: 1,
    })
  })

  it('rolls back cleanup and leaves the request pending when a family delete fails', async () => {
    const fixture = await createFixture('rollback')
    await createWithdrawal(fixture)
    await createAnalyticsData(fixture)
    const failingPrisma = prisma.$extends({
      query: {
        participantChatAnalytics: {
          async deleteMany() {
            throw new Error('Synthetic analytics cleanup failure')
          },
        },
      },
    })

    await expect(
      processParticipantAnalyticsWithdrawal(
        fixture.participantId,
        failingPrisma as unknown as PrismaClient
      )
    ).rejects.toThrow('Synthetic analytics cleanup failure')
    expect(await readAnalyticsCounts(fixture.participantId)).toEqual({
      participant: 1,
      competency: 1,
      course: 1,
      performance: 1,
      activity: 1,
      chat: 1,
      outcome: 1,
      liveQuiz: 1,
    })
    expect(await readWithdrawal(fixture)).toMatchObject({
      completedAt: null,
      choiceEvent: { revision: WITHDRAWAL_REVISION },
    })

    await expect(
      processParticipantAnalyticsWithdrawal(fixture.participantId, prisma)
    ).resolves.toBe(1)
    expect(await readAnalyticsCounts(fixture.participantId)).toEqual({
      participant: 0,
      competency: 0,
      course: 0,
      performance: 0,
      activity: 0,
      chat: 0,
      outcome: 0,
      liveQuiz: 0,
    })
    expect(await readWithdrawal(fixture)).toMatchObject({
      completedAt: expect.any(Date),
    })
  })

  it('keeps a pending withdrawal after analytics is re-enabled', async () => {
    const fixture = await createFixture('reenable')
    await createWithdrawal(fixture)
    await createAnalyticsData(fixture)

    await expect(
      setLearningAnalyticsConsent(
        {
          consent: true,
          expectedRevision: WITHDRAWAL_REVISION,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        },
        participantContext(fixture.participantId)
      )
    ).resolves.toMatchObject({
      learningAnalyticsConsent: true,
      dataUseRevision: WITHDRAWAL_REVISION + 1,
    })
    expect(await readWithdrawal(fixture)).toMatchObject({ completedAt: null })

    await expect(
      processParticipantAnalyticsWithdrawal(fixture.participantId, prisma)
    ).resolves.toBe(1)
    expect(
      await prisma.participant.findUniqueOrThrow({
        where: { id: fixture.participantId },
        select: { learningAnalyticsConsent: true },
      })
    ).toEqual({ learningAnalyticsConsent: true })
    expect(await readWithdrawal(fixture)).toMatchObject({
      completedAt: expect.any(Date),
    })
  })

  it('processes only pending requests at or before the scheduled cutoff', async () => {
    const oldFixture = await createFixture('scheduled-old')
    const futureFixture = await createFixture('scheduled-future')
    await createWithdrawal(oldFixture, {
      requestedAt: new Date(Date.now() - 60_000),
    })
    await createWithdrawal(futureFixture, {
      requestedAt: new Date(Date.now() + 60 * 60_000),
    })
    await createAnalyticsData(oldFixture)
    await createAnalyticsData(futureFixture)

    await expect(
      handleParticipantAnalyticsWithdrawals(
        {},
        { prisma } as Parameters<
          typeof handleParticipantAnalyticsWithdrawals
        >[1],
        {} as Parameters<typeof handleParticipantAnalyticsWithdrawals>[2]
      )
    ).resolves.toBe(true)

    expect(await readWithdrawal(oldFixture)).toMatchObject({
      completedAt: expect.any(Date),
    })
    expect(await readWithdrawal(futureFixture)).toMatchObject({
      completedAt: null,
    })
    expect(await readAnalyticsCounts(oldFixture.participantId)).toMatchObject({
      participant: 0,
      competency: 0,
    })
    expect(await readAnalyticsCounts(futureFixture.participantId)).toEqual({
      participant: 1,
      competency: 1,
      course: 1,
      performance: 1,
      activity: 1,
      chat: 1,
      outcome: 1,
      liveQuiz: 1,
    })
  })
})
