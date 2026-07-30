import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ActivityLevel,
  AnalyticsType,
  LearningAnalyticsParticipationStatus,
  Locale,
  PerformanceLevel,
  PrismaClient,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { readDedicatedLearningAnalyticsCountsForCourse } from '../src/lib/learningAnalyticsCleanup.js'
import {
  getActivityAnalytics,
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
  getCourseWeeklyActivity,
} from '../src/services/analytics.js'
import {
  createCourse,
  setCourseLearningAnalyticsEnabled,
} from '../src/services/courses.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCourse,
  seedElements,
  seedMicroLearning,
  seedPracticeQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Learning analytics course control', () => {
  const originalRolloutFlag =
    process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let ownerCtx: ContextWithUser
  let otherUserCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    emitter = initialized.emitter
    hatchet = initialized.hatchet
  })

  afterAll(async () => {
    if (typeof originalRolloutFlag === 'undefined') {
      delete process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED
    } else {
      process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED =
        originalRolloutFlag
    }
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED = 'true'
    const initialized = await testInitialization(prisma, hatchet, emitter)
    ownerCtx = initialized.userOneCtx
    otherUserCtx = initialized.userTwoCtx
  })

  afterEach(async () => await testCleanup(prisma))

  it('fails closed when the learning analytics rollout gate is disabled', async () => {
    process.env.NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED = 'false'
    const course = await seedCourse({}, ownerCtx)

    await expect(
      setCourseLearningAnalyticsEnabled(
        { courseId: course.id, isEnabled: true },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'LEARNING_ANALYTICS_NOT_AVAILABLE' },
    })
    await prisma.course.update({
      where: { id: course.id },
      data: { isLearningAnalyticsEnabled: true },
    })
    await expect(
      getCourseActivityAnalytics({ courseId: course.id }, ownerCtx)
    ).resolves.toBeNull()
  })

  it('creates courses with learning analytics disabled unless explicitly enabled', async () => {
    const baseArgs = {
      name: 'LA course',
      displayName: 'LA course',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3_600_000),
      isGroupCreationEnabled: false,
      groupDeadlineDate: new Date(Date.now() + 3_600_000),
      maxGroupSize: 5,
      preferredGroupSize: 3,
      language: Locale.en,
      isGamificationEnabled: false,
    }

    const disabled = await createCourse(baseArgs, ownerCtx)
    const enabled = await createCourse(
      {
        ...baseArgs,
        name: 'Enabled LA course',
        isLearningAnalyticsEnabled: true,
      },
      ownerCtx
    )

    expect(disabled.isLearningAnalyticsEnabled).toBe(false)
    expect(enabled.isLearningAnalyticsEnabled).toBe(true)
  })

  it('requires ADMIN permission through the GraphQL mutation', async () => {
    const course = await seedCourse({}, ownerCtx)
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    const resolver = schema.getMutationType()?.getFields()
      .setCourseLearningAnalyticsEnabled?.resolve
    expect(resolver).toBeDefined()

    await expect(
      resolver!(
        {},
        { courseId: course.id, isEnabled: true },
        otherUserCtx,
        {} as never
      )
    ).resolves.toBeNull()
    await expect(
      resolver!(
        {},
        { courseId: course.id, isEnabled: true },
        ownerCtx,
        {} as never
      )
    ).resolves.toMatchObject({ isLearningAnalyticsEnabled: true })
  })

  it('denies every lecturer analytics read while learning analytics is disabled', async () => {
    const course = await seedCourse({}, ownerCtx)
    const practiceQuiz = await seedPracticeQuiz(
      { elements: [], courseId: course.id },
      ownerCtx
    )
    await recomputeDerivedPermissions(
      { practiceQuizId: practiceQuiz.id },
      prisma
    )

    await expect(
      getCourseActivityAnalytics({ courseId: course.id }, ownerCtx)
    ).resolves.toBeNull()
    await expect(
      getCourseWeeklyActivity({ courseId: course.id }, ownerCtx)
    ).resolves.toBeNull()
    await expect(
      getCoursePerformanceAnalytics({ courseId: course.id }, ownerCtx)
    ).resolves.toBeNull()
    await expect(
      getActivityAnalytics({ activityId: practiceQuiz.id }, ownerCtx)
    ).resolves.toBeNull()
  })

  it('deletes dedicated analytics while preserving operational state', async () => {
    const course = await seedCourse({}, ownerCtx)
    const enabledCourse = await setCourseLearningAnalyticsEnabled(
      { courseId: course.id, isEnabled: true },
      ownerCtx
    )
    expect(enabledCourse.isLearningAnalyticsEnabled).toBe(true)

    const participant = await prisma.participant.create({
      data: {
        username: `la-participant-${course.id}`,
        password: 'unused',
        xp: 25,
        participations: {
          create: {
            courseId: course.id,
            isActive: true,
            learningAnalyticsStatus:
              LearningAnalyticsParticipationStatus.INCLUDED,
            learningAnalyticsIncludedFrom: new Date(),
            learningAnalyticsChoiceAt: new Date(),
            learningAnalyticsDisclosureVersion: 'test-v1',
            learningAnalyticsChoiceEvents: {
              create: {
                status: LearningAnalyticsParticipationStatus.INCLUDED,
                includedFrom: new Date(),
                disclosureVersion: 'test-v1',
              },
            },
          },
        },
      },
      include: { participations: true },
    })
    const participation = participant.participations[0]!
    const timestamp = new Date('2026-07-01T00:00:00.000Z')

    const participantAnalytics = await prisma.participantAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp,
        trialsCount: 1,
        responseCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        meanCorrectCount: 1,
        meanPartialCorrectCount: 0,
        meanWrongCount: 0,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    const aggregatedAnalytics = await prisma.aggregatedAnalytics.create({
      data: {
        type: AnalyticsType.DAILY,
        timestamp,
        responseCount: 1,
        participantCount: 1,
        totalScore: 1,
        totalPoints: 1,
        totalXp: 1,
        totalElementsAvailable: 1,
        courseId: course.id,
      },
    })
    const competencyTree = await prisma.competencyTree.create({
      data: {
        name: `LA test tree ${course.id}`,
        ownerId: ownerCtx.user.sub,
      },
    })
    const competency = await prisma.competency.create({
      data: {
        name: 'LA test competency',
        lft: 1,
        rgt: 2,
        treeId: competencyTree.id,
      },
    })
    await prisma.competencyAnalytics.create({
      data: {
        unsolvedQuestionsCount: 0,
        lastCorrectCount: 1,
        lastPartialCorrectCount: 0,
        lastWrongCount: 0,
        competencyId: competency.id,
        participantAnalyticsId: participantAnalytics.id,
      },
    })
    await prisma.aggregatedCompetencyAnalytics.create({
      data: {
        meanUnsolvedQuestionsCount: 0,
        meanLastCorrectCount: 1,
        meanLastPartialCorrectCount: 0,
        meanLastWrongCount: 0,
        competencyId: competency.id,
        aggregatedAnalyticsId: aggregatedAnalytics.id,
      },
    })
    await prisma.participantCourseAnalytics.create({
      data: {
        activeWeeks: 1,
        activeDaysPerWeek: 1,
        meanElementsPerDay: 1,
        activityLevel: ActivityLevel.HIGH,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    await prisma.aggregatedCourseAnalytics.create({
      data: {
        courseParticipantCount: 1,
        activityMonday: 1,
        activityTuesday: 0,
        activityWednesday: 0,
        activityThursday: 0,
        activityFriday: 0,
        activitySaturday: 0,
        activitySunday: 0,
        courseId: course.id,
      },
    })
    await prisma.participantPerformance.create({
      data: {
        firstErrorRate: 0,
        firstPerformance: PerformanceLevel.HIGH,
        lastErrorRate: 0,
        lastPerformance: PerformanceLevel.HIGH,
        totalErrorRate: 0,
        totalPerformance: PerformanceLevel.HIGH,
        participantId: participant.id,
        courseId: course.id,
      },
    })
    const { AC1 } = await seedAnswerCollections(ownerCtx)
    const { SC } = await seedElements(ownerCtx, AC1.id)
    const practiceQuiz = await seedPracticeQuiz(
      {
        elements: [{ id: SC.id, type: SC.type }],
        courseId: course.id,
      },
      ownerCtx
    )
    const practiceQuizWithInstance =
      await prisma.practiceQuiz.findUniqueOrThrow({
        where: { id: practiceQuiz.id },
        include: { stacks: { include: { elements: true } } },
      })
    const instance = practiceQuizWithInstance.stacks[0]!.elements[0]!
    const microLearning = await seedMicroLearning(
      {
        elements: [{ id: SC.id, type: SC.type }],
        courseId: course.id,
      },
      ownerCtx
    )
    await prisma.instancePerformance.create({
      data: {
        responseCount: 1,
        averageTimeSpent: 1,
        totalErrorRate: 0,
        totalPartialRate: 0,
        totalCorrectRate: 1,
        instanceId: instance.id,
        courseId: course.id,
      },
    })
    await prisma.activityPerformance.create({
      data: {
        totalErrorRate: 0,
        totalPartialRate: 0,
        totalCorrectRate: 1,
        practiceQuizId: practiceQuiz.id,
        courseId: course.id,
      },
    })
    await prisma.participantActivityPerformance.create({
      data: {
        totalScore: 1,
        completion: 1,
        participantId: participant.id,
        practiceQuizId: practiceQuiz.id,
      },
    })
    await prisma.participantActivityPerformance.create({
      data: {
        totalScore: 1,
        completion: 1,
        participantId: participant.id,
        microLearningId: microLearning.id,
      },
    })
    await prisma.activityProgress.create({
      data: {
        totalCourseParticipants: 1,
        startedCount: 1,
        completedCount: 1,
        practiceQuizId: practiceQuiz.id,
        courseId: course.id,
      },
    })
    await prisma.questionResponse.create({
      data: {
        trialsCount: 1,
        totalScore: 1,
        totalPointsAwarded: 2,
        totalXpAwarded: 3,
        averageTimeSpent: 1,
        firstResponse: { choices: [] },
        firstResponseCorrectness: ResponseCorrectness.CORRECT,
        lastResponse: { choices: [] },
        lastResponseCorrectness: ResponseCorrectness.CORRECT,
        participantId: participant.id,
        participationId: participation.id,
        elementInstanceId: instance.id,
        practiceQuizId: practiceQuiz.id,
        courseId: course.id,
      },
    })
    await prisma.questionResponseDetail.create({
      data: {
        score: 1,
        pointsAwarded: 2,
        xpAwarded: 3,
        timeSpent: 1,
        response: { choices: [] },
        participantId: participant.id,
        participationId: participation.id,
        elementInstanceId: instance.id,
        practiceQuizId: practiceQuiz.id,
      },
    })
    await prisma.elementFeedback.create({
      data: {
        upvote: true,
        feedback: 'Synthetic operational feedback',
        participantId: participant.id,
        elementInstanceId: instance.id,
        elementId: SC.id,
      },
    })

    await expect(
      readDedicatedLearningAnalyticsCountsForCourse(prisma, course.id)
    ).resolves.toEqual({
      participantAnalytics: 1,
      competencyAnalytics: 1,
      aggregatedAnalytics: 1,
      aggregatedCompetencyAnalytics: 1,
      participantCourseAnalytics: 1,
      aggregatedCourseAnalytics: 1,
      participantPerformance: 1,
      instancePerformance: 1,
      activityPerformance: 1,
      participantActivityPerformance: 2,
      activityProgress: 1,
    })

    await setCourseLearningAnalyticsEnabled(
      { courseId: course.id, isEnabled: false },
      ownerCtx
    )
    await expect(
      setCourseLearningAnalyticsEnabled(
        { courseId: course.id, isEnabled: false },
        ownerCtx
      )
    ).resolves.toMatchObject({ isLearningAnalyticsEnabled: false })

    await expect(
      readDedicatedLearningAnalyticsCountsForCourse(prisma, course.id)
    ).resolves.toEqual({
      participantAnalytics: 0,
      competencyAnalytics: 0,
      aggregatedAnalytics: 0,
      aggregatedCompetencyAnalytics: 0,
      participantCourseAnalytics: 0,
      aggregatedCourseAnalytics: 0,
      participantPerformance: 0,
      instancePerformance: 0,
      activityPerformance: 0,
      participantActivityPerformance: 0,
      activityProgress: 0,
    })

    await expect(
      prisma.participation.findUnique({
        where: { id: participation.id },
        include: { learningAnalyticsChoiceEvents: true },
      })
    ).resolves.toMatchObject({
      isActive: true,
      learningAnalyticsStatus: LearningAnalyticsParticipationStatus.INCLUDED,
      learningAnalyticsDisclosureVersion: 'test-v1',
      learningAnalyticsChoiceEvents: [
        {
          status: LearningAnalyticsParticipationStatus.INCLUDED,
          disclosureVersion: 'test-v1',
        },
      ],
    })
    await expect(
      prisma.practiceQuiz.findUnique({ where: { id: practiceQuiz.id } })
    ).resolves.not.toBeNull()
    await expect(
      prisma.microLearning.findUnique({ where: { id: microLearning.id } })
    ).resolves.not.toBeNull()
    await expect(
      prisma.participant.findUnique({ where: { id: participant.id } })
    ).resolves.toMatchObject({ xp: 25 })
    await expect(
      prisma.questionResponse.findFirst({
        where: { participantId: participant.id },
      })
    ).resolves.toMatchObject({
      totalScore: 1,
      totalPointsAwarded: 2,
      totalXpAwarded: 3,
    })
    await expect(
      prisma.questionResponseDetail.count({
        where: { participantId: participant.id },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.elementFeedback.findFirst({
        where: { participantId: participant.id },
      })
    ).resolves.toMatchObject({
      upvote: true,
      feedback: 'Synthetic operational feedback',
    })

    await setCourseLearningAnalyticsEnabled(
      { courseId: course.id, isEnabled: true },
      ownerCtx
    )
    await expect(
      getCourseActivityAnalytics({ courseId: course.id }, ownerCtx)
    ).resolves.toMatchObject({ name: course.name })
  })
})
