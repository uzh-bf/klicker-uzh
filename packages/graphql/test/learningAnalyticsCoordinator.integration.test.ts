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
import { toggleArchiveCourse } from '../src/services/courses.js'
import {
  completeLearningAnalyticsCourse,
  selectLearningAnalyticsBatchCourses,
  startLearningAnalyticsCourse,
} from '../src/services/learningAnalyticsCoordinator.js'
import {
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
} from '../src/services/analytics.js'

const TEST_PREFIX = `learning-analytics-coordinator-integration-${Date.now()}`
const fixtureIds = {
  chatbots: [] as string[],
  courses: [] as string[],
  participants: [] as string[],
  practiceQuizzes: [] as string[],
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

function ownerContext(userId: string): ContextWithUser {
  return {
    prisma,
    user: {
      sub: userId,
      role: UserRole.USER,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
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

async function createParticipant(label: string, consent = false) {
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'integration-test-password',
      ...(consent
        ? {
            learningAnalyticsConsent: true,
            learningAnalyticsChoiceAt: new Date('2026-08-27T01:00:00.000Z'),
            learningAnalyticsDisclosureVersion: 'v1',
          }
        : {}),
    },
  })
  fixtureIds.participants.push(participant.id)
  return participant
}

async function createCourse(
  label: string,
  ownerId: string,
  {
    participantId,
    isLearningAnalyticsEnabled = true,
    areAnalyticsValid = true,
    analyticsLastComputedAt = new Date('2026-08-26T00:00:00.000Z'),
  }: {
    participantId?: string
    isLearningAnalyticsEnabled?: boolean
    areAnalyticsValid?: boolean
    analyticsLastComputedAt?: Date | null
  } = {}
) {
  const endDate = new Date('2026-09-01T00:00:00.000Z')
  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-${label}`,
      displayName: `${TEST_PREFIX}-${label}`,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate,
      groupDeadlineDate: endDate,
      authType: CourseAuthType.SSO,
      isLearningAnalyticsEnabled,
      areAnalyticsValid,
      analyticsLastComputedAt,
      ownerId,
      ...(participantId
        ? { participations: { create: { participantId } } }
        : {}),
    },
  })
  fixtureIds.courses.push(course.id)
  return course
}

async function readPostgresNow() {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS "now"
  `
  if (!(rows[0]?.now instanceof Date)) {
    throw new Error('PostgreSQL did not return a timestamp')
  }
  return rows[0].now
}

describe('learning-analytics coordinator PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterEach(async () => {
    if (fixtureIds.chatbots.length > 0) {
      await prisma.chatbot.deleteMany({
        where: { id: { in: fixtureIds.chatbots } },
      })
      fixtureIds.chatbots.length = 0
    }
    if (fixtureIds.practiceQuizzes.length > 0) {
      await prisma.practiceQuiz.deleteMany({
        where: { id: { in: fixtureIds.practiceQuizzes } },
      })
      fixtureIds.practiceQuizzes.length = 0
    }
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

  it('uses PostgreSQL publication time instead of a future private completion time', async () => {
    const owner = await createOwner('future-completion')
    const course = await createCourse('future-completion', owner.id)
    const request = {
      contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
      runId: '00000000-0000-0000-0000-000000000010',
      courseId: course.id,
      mode: 'finalize' as const,
    }

    const started = await startLearningAnalyticsCourse(request, prisma)
    expect(started.request).toEqual(request)
    const completedAt = '2099-01-01T00:00:00.000Z'
    const publicationBefore = await readPostgresNow()
    const completion = await completeLearningAnalyticsCourse(
      {
        request: started.request,
        completedAt,
        cleanupOnly: false,
        fenceAt: started.fenceAt,
      },
      prisma
    )
    const publicationAfter = await readPostgresNow()

    expect(completion).toEqual({
      courseId: course.id,
      completedAt,
      cleanupOnly: false,
    })
    const persisted = await prisma.course.findUnique({
      where: { id: course.id },
      select: {
        areAnalyticsValid: true,
        analyticsLastComputedAt: true,
        chatAnalyticsValidAt: true,
        analyticsFinalizedAt: true,
      },
    })
    expect(persisted?.areAnalyticsValid).toBe(true)
    expect(persisted?.analyticsLastComputedAt).toBeInstanceOf(Date)
    expect(persisted?.chatAnalyticsValidAt).toEqual(
      persisted?.analyticsLastComputedAt
    )
    expect(persisted?.analyticsFinalizedAt).toEqual(
      persisted?.analyticsLastComputedAt
    )
    expect(
      persisted!.analyticsLastComputedAt!.getTime()
    ).toBeGreaterThanOrEqual(publicationBefore.getTime())
    expect(persisted!.analyticsLastComputedAt!.getTime()).toBeLessThanOrEqual(
      publicationAfter.getTime()
    )
    expect(persisted!.analyticsLastComputedAt!.getTime()).toBeLessThan(
      Date.parse(completedAt)
    )
  })

  it.each([
    ['incremental', '00000000-0000-0000-0000-000000000011'],
    ['finalize', '00000000-0000-0000-0000-000000000012'],
  ] as const)(
    'upgrades a queued %s request when a member choice is newer',
    async (mode, runId) => {
      const owner = await createOwner(`queued-${mode}`)
      const participant = await createParticipant(`queued-${mode}`, true)
      const course = await createCourse(`queued-${mode}`, owner.id, {
        participantId: participant.id,
      })
      const request = {
        contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
        runId,
        courseId: course.id,
        mode,
        ...(mode === 'incremental' ? { windowSince: '2026-08-26' } : {}),
      }

      const started = await startLearningAnalyticsCourse(request, prisma)

      expect(started.request).toEqual({
        contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
        runId,
        courseId: course.id,
        mode: 'full',
      })
    }
  )

  it('selects PostgreSQL cleanup candidates through direct, practice-quiz, and chatbot ownership', async () => {
    const owner = await createOwner('selector')
    const directParticipant = await createParticipant('selector-direct')
    const practiceParticipant = await createParticipant('selector-practice')
    const chatParticipant = await createParticipant('selector-chat')
    const dirtyParticipant = await createParticipant('selector-dirty', true)

    const directCourse = await createCourse('selector-direct', owner.id, {
      isLearningAnalyticsEnabled: false,
      areAnalyticsValid: false,
      analyticsLastComputedAt: null,
    })
    await prisma.participantAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp: new Date('2026-08-26T00:00:00.000Z'),
        trialsCount: 1,
        responseCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        meanCorrectCount: 1,
        meanPartialCorrectCount: 0,
        meanWrongCount: 0,
        participantId: directParticipant.id,
        courseId: directCourse.id,
      },
    })

    const practiceCourse = await createCourse('selector-practice', owner.id, {
      isLearningAnalyticsEnabled: false,
      areAnalyticsValid: false,
      analyticsLastComputedAt: null,
    })
    const practiceQuiz = await prisma.practiceQuiz.create({
      data: {
        name: `${TEST_PREFIX}-selector-practice-quiz`,
        displayName: `${TEST_PREFIX}-selector-practice-quiz`,
        ownerId: owner.id,
        courseId: practiceCourse.id,
      },
    })
    fixtureIds.practiceQuizzes.push(practiceQuiz.id)
    await prisma.participantActivityPerformance.create({
      data: {
        participantId: practiceParticipant.id,
        practiceQuizId: practiceQuiz.id,
        totalScore: 1,
        completion: 1,
      },
    })

    const chatCourse = await createCourse('selector-chat', owner.id, {
      isLearningAnalyticsEnabled: false,
      areAnalyticsValid: false,
      analyticsLastComputedAt: null,
    })
    const chatbot = await prisma.chatbot.create({
      data: {
        name: `${TEST_PREFIX}-selector-chatbot`,
        ownerId: owner.id,
        courseId: chatCourse.id,
      },
    })
    fixtureIds.chatbots.push(chatbot.id)
    await prisma.participantChatAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp: new Date('2026-08-26T00:00:00.000Z'),
        participantId: chatParticipant.id,
        chatbotId: chatbot.id,
      },
    })

    const dirtyCourse = await createCourse('selector-dirty', owner.id, {
      participantId: dirtyParticipant.id,
    })
    const input = {
      runId: '00000000-0000-4000-8000-000000000020',
      batchDate: '2026-08-27',
      selection: 'nightly' as const,
      includePlatform: true,
      inFlightLimit: 10,
      stopSpawningAt: '2026-08-27T03:45:00.000Z',
      hardDeadlineAt: '2026-08-27T04:00:00.000Z',
    }

    const selected = await selectLearningAnalyticsBatchCourses(input, prisma)
    const selectedById = new Map(
      selected.courses.map((courseRequest) => [
        courseRequest.courseId,
        courseRequest,
      ])
    )
    for (const course of [directCourse, practiceCourse, chatCourse]) {
      expect(selectedById.get(course.id)).toMatchObject({
        courseId: course.id,
        mode: 'full',
      })
    }
    expect(selectedById.get(dirtyCourse.id)).toMatchObject({
      courseId: dirtyCourse.id,
      mode: 'full',
    })

    const explicitRunId = '00000000-0000-4000-8000-000000000021'
    const explicit = await selectLearningAnalyticsBatchCourses(
      {
        ...input,
        runId: explicitRunId,
        selection: 'explicit-full' as const,
        explicitCourseIds: [directCourse.id, dirtyCourse.id],
      },
      prisma
    )
    expect(explicit.courses).toEqual(
      [directCourse.id, dirtyCourse.id].sort().map((courseId) => ({
        contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
        runId: explicitRunId,
        courseId,
        mode: 'full',
      }))
    )
  })

  it('rejects in-flight recomputation after consent or archive changes and accepts fresh runs', async () => {
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
    expect(started.request).toEqual(request)
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
        request: started.request,
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
    expect(freshStart.request).toEqual(freshRequest)
    const freshCompletedAt = new Date(Date.now() + 60_000).toISOString()
    const freshPublicationBefore = await readPostgresNow()
    await completeLearningAnalyticsCourse(
      {
        request: freshStart.request,
        completedAt: freshCompletedAt,
        cleanupOnly: false,
        fenceAt: freshStart.fenceAt,
      },
      prisma
    )
    const freshPublicationAfter = await readPostgresNow()

    const freshCourse = await prisma.course.findUnique({
      where: { id: course.id },
      select: {
        areAnalyticsValid: true,
        analyticsLastComputedAt: true,
        chatAnalyticsValidAt: true,
      },
    })
    expect(freshCourse?.areAnalyticsValid).toBe(true)
    expect(freshCourse?.analyticsLastComputedAt).toBeInstanceOf(Date)
    expect(freshCourse?.chatAnalyticsValidAt).toEqual(
      freshCourse?.analyticsLastComputedAt
    )
    expect(
      freshCourse!.analyticsLastComputedAt!.getTime()
    ).toBeGreaterThanOrEqual(freshPublicationBefore.getTime())
    expect(freshCourse!.analyticsLastComputedAt!.getTime()).toBeLessThanOrEqual(
      freshPublicationAfter.getTime()
    )
    expect(freshCourse!.analyticsLastComputedAt!.getTime()).toBeLessThan(
      Date.parse(freshCompletedAt)
    )
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

    const withdrawn = await setLearningAnalyticsConsent({ consent: false }, ctx)
    expect(withdrawn?.learningAnalyticsConsent).toBe(false)
    const hiddenAfterWithdrawal = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(hiddenAfterWithdrawal?.participantCourseAnalytics).toHaveLength(0)
    const hiddenPerformanceAfterWithdrawal =
      await getCoursePerformanceAnalytics({ courseId: course.id }, ctx)
    expect(
      hiddenPerformanceAfterWithdrawal?.participantPerformances
    ).toHaveLength(0)

    const reenabled = await setLearningAnalyticsConsent({ consent: true }, ctx)
    expect(reenabled?.learningAnalyticsConsent).toBe(true)
    const hiddenAfterReenableBeforeFreshRun = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(
      hiddenAfterReenableBeforeFreshRun?.participantCourseAnalytics
    ).toHaveLength(0)
    const hiddenPerformanceAfterReenableBeforeFreshRun =
      await getCoursePerformanceAnalytics({ courseId: course.id }, ctx)
    expect(
      hiddenPerformanceAfterReenableBeforeFreshRun?.participantPerformances
    ).toHaveLength(0)

    const reenableRequest = {
      ...request,
      runId: '00000000-0000-0000-0000-000000000003',
      mode: 'incremental' as const,
      windowSince: '2026-08-26',
    }
    const reenableStart = await startLearningAnalyticsCourse(
      reenableRequest,
      prisma
    )
    expect(reenableStart.request).toEqual({
      contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
      runId: reenableRequest.runId,
      courseId: course.id,
      mode: 'full',
    })
    await completeLearningAnalyticsCourse(
      {
        request: reenableStart.request,
        completedAt: new Date().toISOString(),
        cleanupOnly: false,
        fenceAt: reenableStart.fenceAt,
      },
      prisma
    )
    const visibleAfterReenableFreshCompletion =
      await getCourseActivityAnalytics({ courseId: course.id }, ctx)
    expect(
      visibleAfterReenableFreshCompletion?.participantCourseAnalytics
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
      data: {
        isArchived: true,
        endDate: new Date('2026-08-20T00:00:00.000Z'),
      },
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

    await prisma.course.update({
      where: { id: course.id },
      data: { isArchived: false },
    })
    const inFlightRequest = {
      ...request,
      runId: '00000000-0000-0000-0000-000000000004',
      mode: 'incremental' as const,
      windowSince: '2026-08-26',
    }
    const inFlightStart = await startLearningAnalyticsCourse(
      inFlightRequest,
      prisma
    )
    expect(inFlightStart.cleanupOnly).toBe(false)
    await prisma.course.update({
      where: { id: course.id },
      data: { isArchived: true },
    })

    const markerBeforeCleanup = await prisma.course.findUniqueOrThrow({
      where: { id: course.id },
      select: { analyticsLastComputedAt: true },
    })
    const cleanupRequest = {
      ...request,
      runId: '00000000-0000-0000-0000-000000000005',
    }
    const cleanupStart = await startLearningAnalyticsCourse(
      cleanupRequest,
      prisma
    )
    expect(cleanupStart.cleanupOnly).toBe(true)
    await prisma.participantCourseAnalytics.deleteMany({
      where: { courseId: course.id },
    })
    await prisma.participantPerformance.deleteMany({
      where: { courseId: course.id },
    })
    await completeLearningAnalyticsCourse(
      {
        request: cleanupStart.request,
        completedAt: new Date().toISOString(),
        cleanupOnly: true,
        fenceAt: cleanupStart.fenceAt,
      },
      prisma
    )
    await expect(
      prisma.course.findUniqueOrThrow({
        where: { id: course.id },
        select: { analyticsLastComputedAt: true },
      })
    ).resolves.toEqual(markerBeforeCleanup)

    const unarchiveBefore = await readPostgresNow()
    await toggleArchiveCourse(
      { id: course.id, isArchived: false },
      ownerContext(user.id)
    )
    const unarchiveAfter = await readPostgresNow()
    const restoredCourse = await prisma.course.findUniqueOrThrow({
      where: { id: course.id },
      select: {
        isArchived: true,
        areAnalyticsValid: true,
        analyticsLastComputedAt: true,
        chatAnalyticsValidAt: true,
        analyticsFinalizedAt: true,
      },
    })
    expect(restoredCourse).toMatchObject({
      isArchived: false,
      areAnalyticsValid: false,
      chatAnalyticsValidAt: null,
      analyticsFinalizedAt: null,
    })
    expect(restoredCourse.analyticsLastComputedAt).toBeInstanceOf(Date)
    expect(
      restoredCourse.analyticsLastComputedAt!.getTime()
    ).toBeGreaterThanOrEqual(unarchiveBefore.getTime())
    expect(
      restoredCourse.analyticsLastComputedAt!.getTime()
    ).toBeLessThanOrEqual(unarchiveAfter.getTime())
    await expect(
      getCourseActivityAnalytics({ courseId: course.id }, ctx)
    ).resolves.toBeNull()

    await completeLearningAnalyticsCourse(
      {
        request: inFlightStart.request,
        completedAt: new Date().toISOString(),
        cleanupOnly: false,
        fenceAt: inFlightStart.fenceAt,
      },
      prisma
    )
    await expect(
      prisma.course.findUniqueOrThrow({
        where: { id: course.id },
        select: {
          areAnalyticsValid: true,
          analyticsLastComputedAt: true,
        },
      })
    ).resolves.toEqual({
      areAnalyticsValid: false,
      analyticsLastComputedAt: restoredCourse.analyticsLastComputedAt,
    })

    const selectedAfterUnarchive = await selectLearningAnalyticsBatchCourses(
      {
        runId: '00000000-0000-4000-8000-000000000022',
        batchDate: '2026-08-27',
        selection: 'nightly',
        includePlatform: true,
        inFlightLimit: 10,
        stopSpawningAt: '2026-08-27T03:45:00.000Z',
        hardDeadlineAt: '2026-08-27T04:00:00.000Z',
      },
      prisma
    )
    expect(
      selectedAfterUnarchive.courses.find(
        (selectedCourse) => selectedCourse.courseId === course.id
      )
    ).toMatchObject({ courseId: course.id, mode: 'full' })

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
    const rebuildRequest = {
      ...request,
      runId: '00000000-0000-0000-0000-000000000006',
      mode: 'incremental' as const,
      windowSince: '2026-08-26',
    }
    const rebuildStart = await startLearningAnalyticsCourse(
      rebuildRequest,
      prisma
    )
    expect(rebuildStart.request.mode).toBe('full')
    await completeLearningAnalyticsCourse(
      {
        request: rebuildStart.request,
        completedAt: new Date().toISOString(),
        cleanupOnly: false,
        fenceAt: rebuildStart.fenceAt,
      },
      prisma
    )
    const visibleAfterArchiveRebuild = await getCourseActivityAnalytics(
      { courseId: course.id },
      ctx
    )
    expect(visibleAfterArchiveRebuild?.participantCourseAnalytics).toHaveLength(
      1
    )
  })
})
