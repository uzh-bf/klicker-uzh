import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { ContextWithUser } from '../src/lib/context.js'
import { getLiveQuizResetSummary } from '../src/services/liveQuizReset.js'
import {
  initializePrisma,
  seedCourse,
  seedEndedRegularLiveQuizForReset,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('live quiz reset summary', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser
  let userThreeCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    emitter = initialized.emitter
    hatchet = initialized.hatchet
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
    userThreeCtx = initialized.userThreeCtx
    await userOneCtx.redisExec.flushdb()
    await userOneCtx.redisAssessmentExec.flushdb()
  })

  afterEach(async () => {
    await userOneCtx.redisExec.flushdb()
    await userOneCtx.redisAssessmentExec.flushdb()
    await testCleanup(prisma)
  })

  it('summarizes every destructive category for an eligible regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )

    const summary = await getLiveQuizResetSummary(
      { quizId: fixture.liveQuizId },
      userOneCtx
    )

    expect(summary).toEqual({
      eligible: true,
      reason: 'ELIGIBLE',
      legacyReconstructionStatus: 'NOT_REQUIRED',
      numOfResponses: 1,
      numOfFeedbacks: 1,
      numOfConfusionFeedbacks: 1,
      numOfLeaderboardEntries: 1,
      coursePointsToReverse: fixture.awardedCoursePoints,
      xpToReverse: fixture.awardedParticipantXp,
      numOfTimelineChanges: 1,
      numOfAchievementChanges: 1,
    })
  })

  it('allows an activity administrator to inspect a regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await prisma.permission.create({
      data: {
        liveQuizId: fixture.liveQuizId,
        userId: userTwoCtx.user.sub,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: fixture.liveQuizId },
      prisma
    )

    await expect(
      getLiveQuizResetSummary({ quizId: fixture.liveQuizId }, userTwoCtx)
    ).resolves.toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
    })
  })

  it.each([
    PublicationStatus.DRAFT,
    PublicationStatus.SCHEDULED,
    PublicationStatus.PUBLISHED,
  ])('marks %s quizzes ineligible', async (status) => {
    const quiz = await seedLiveQuiz({ elements: [], status }, userOneCtx)

    await expect(
      getLiveQuizResetSummary({ quizId: quiz.id }, userOneCtx)
    ).resolves.toMatchObject({
      eligible: false,
      reason: 'INVALID_STATE',
    })
  })

  it('marks a deleted ended quiz ineligible', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: quiz.id },
      data: { isDeleted: true },
    })

    await expect(
      getLiveQuizResetSummary({ quizId: quiz.id }, userOneCtx)
    ).resolves.toMatchObject({
      eligible: false,
      reason: 'INVALID_STATE',
    })
  })

  it('returns null without owner or administrator permission', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )

    await expect(
      getLiveQuizResetSummary({ quizId: fixture.liveQuizId }, userTwoCtx)
    ).resolves.toBeNull()
  })

  it('preserves the assessment course owner and administrator policy', async () => {
    const course = await seedCourse(
      { isAssessmentEnabled: true, isGamificationEnabled: false },
      userOneCtx
    )
    const quiz = await seedLiveQuiz(
      {
        elements: [],
        courseId: course.id,
        status: PublicationStatus.ENDED,
      },
      userOneCtx
    )
    await prisma.permission.createMany({
      data: [
        {
          courseId: course.id,
          userId: userTwoCtx.user.sub,
          permissionLevel: PermissionLevel.ADMIN,
        },
        {
          liveQuizId: quiz.id,
          userId: userThreeCtx.user.sub,
          permissionLevel: PermissionLevel.ADMIN,
        },
      ],
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    await recomputeDerivedPermissions({ liveQuizId: quiz.id }, prisma)

    await expect(
      getLiveQuizResetSummary({ quizId: quiz.id }, userOneCtx)
    ).resolves.toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
    })
    await expect(
      getLiveQuizResetSummary({ quizId: quiz.id }, userTwoCtx)
    ).resolves.toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
    })
    await expect(
      getLiveQuizResetSummary({ quizId: quiz.id }, userThreeCtx)
    ).resolves.toBeNull()
  })

  it('does not require reconstruction for a non-gamified legacy quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )

    await expect(
      getLiveQuizResetSummary({ quizId: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
      legacyReconstructionStatus: 'NOT_REQUIRED',
    })
  })

  it('reconstructs legacy XP for a standalone gamified regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false, withCourse: false },
      userOneCtx
    )

    await expect(
      getLiveQuizResetSummary({ quizId: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
      legacyReconstructionStatus: 'AVAILABLE',
      coursePointsToReverse: 0,
      xpToReverse: fixture.awardedParticipantXp,
      numOfTimelineChanges: 0,
    })
  })

  it('blocks invalid cross-quiz and non-applied reward pointers', async () => {
    const crossQuizFixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    const otherQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )
    const otherRun = await prisma.liveQuizRewardRun.create({
      data: {
        liveQuizId: otherQuiz.id,
        endedAt: crossQuizFixture.timelineDate,
      },
    })
    await prisma.liveQuiz.update({
      where: { id: crossQuizFixture.liveQuizId },
      data: { activeRewardRunId: otherRun.id },
    })

    await expect(
      getLiveQuizResetSummary(
        { quizId: crossQuizFixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({
      eligible: false,
      reason: 'REWARD_DATA_UNAVAILABLE',
      legacyReconstructionStatus: 'UNAVAILABLE',
    })

    const reversedFixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    const reversedRun = await prisma.liveQuizRewardRun.create({
      data: {
        liveQuizId: reversedFixture.liveQuizId,
        endedAt: reversedFixture.timelineDate,
        status: 'REVERSED',
      },
    })
    await prisma.liveQuiz.update({
      where: { id: reversedFixture.liveQuizId },
      data: { activeRewardRunId: reversedRun.id },
    })

    await expect(
      getLiveQuizResetSummary(
        { quizId: reversedFixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({
      eligible: false,
      reason: 'REWARD_DATA_UNAVAILABLE',
      legacyReconstructionStatus: 'UNAVAILABLE',
    })
  })
})
