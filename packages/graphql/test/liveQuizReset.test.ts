import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementBlockStatus,
  LiveQuizRewardRunStatus,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
  TimelineEntryType,
} from '@klicker-uzh/prisma/client'
import type { ElementData, ElementInstanceResults } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { graphql, print } from 'graphql/index.js'
import { v4 as uuidv4 } from 'uuid'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  GetLiveQuizResetSummaryDocument,
  ResetLiveQuizDocument,
} from '../src/ops.js'
import {
  clearLiveQuizExecutionCache,
  getLiveQuizResetSummary,
  handleCleanupLiveQuizResetCache,
  resetLiveQuiz,
} from '../src/services/liveQuizReset.js'
import {
  handlePublishScheduledLiveQuiz,
  startLiveQuiz,
} from '../src/services/liveQuizzes.js'
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
    vi.spyOn(
      userOneCtx.tasks.createAuditLogEntry,
      'runNoWait'
    ).mockResolvedValue({} as never)
    vi.spyOn(
      userOneCtx.tasks.cleanupLiveQuizResetCache,
      'runNoWait'
    ).mockResolvedValue({} as never)
    await userOneCtx.redisExec.flushdb()
    await userOneCtx.redisAssessmentExec.flushdb()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await userOneCtx.redisExec.flushdb()
    await userOneCtx.redisAssessmentExec.flushdb()
    await testCleanup(prisma)
  })

  async function makeFixtureInstanceResettable(instanceId: number) {
    await prisma.elementInstance.update({
      where: { id: instanceId },
      data: {
        elementData: {
          type: 'SC',
          options: { choices: [] },
        } as unknown as ElementData,
      },
    })
  }

  function mockResetDelivery(ctx: ContextWithUser) {
    const audit = vi.mocked(ctx.tasks.createAuditLogEntry.runNoWait)
    const cleanup = vi.mocked(ctx.tasks.cleanupLiveQuizResetCache.runNoWait)
    return { audit, cleanup }
  }

  function globalHandlerContext(ctx: ContextWithUser) {
    return {
      hatchet: ctx.hatchet,
      pubSub: ctx.pubSub,
      emitter: ctx.emitter,
      redisExec: ctx.redisExec,
      redisAssessmentExec: ctx.redisAssessmentExec,
      prisma: ctx.prisma,
    }
  }

  function controlLiveQuizCacheInitialization(
    ctx: ContextWithUser,
    liveQuizId: string
  ) {
    const redis = ctx.redisExec
    const sentinelKey = `lq:${liveQuizId}:post-initialization-sentinel`
    let initializationCount = 0
    let markInitialized!: () => void
    const initialized = new Promise<void>((resolve) => {
      markInitialized = resolve
    })
    let allowCompletion!: () => void
    const completionAllowed = new Promise<void>((resolve) => {
      allowCompletion = resolve
    })
    const controlledEval = async (
      script: string | Buffer,
      numkeys: number | string,
      ...args: (string | Buffer | number)[]
    ) => {
      const result = await redis.eval(script, numkeys, ...args)
      initializationCount += 1
      await redis.set(sentinelKey, 'preserved')
      markInitialized()
      await completionAllowed
      return result
    }
    const controlledRedis = new Proxy(redis, {
      get(target, property) {
        if (property === 'eval') return controlledEval
        const value = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })

    return {
      redis: controlledRedis,
      sentinelKey,
      waitUntilInitialized: () => initialized,
      allowCompletion,
      getInitializationCount: () => initializationCount,
    }
  }

  it('summarizes every destructive category for an eligible regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)

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

  it('counts aggregate-only responses when they exceed persisted rows', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await prisma.elementInstance.update({
      where: { id: fixture.instanceId },
      data: {
        results: { total: 91 } as ElementInstanceResults,
        anonymousResults: { total: 37 } as ElementInstanceResults,
      },
    })

    await expect(
      getLiveQuizResetSummary({ quizId: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({ numOfResponses: 128 })
  })

  it('counts persisted responses when they exceed aggregate totals', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await prisma.elementInstance.update({
      where: { id: fixture.instanceId },
      data: {
        results: { total: 0 } as ElementInstanceResults,
        anonymousResults: { total: 0 } as ElementInstanceResults,
      },
    })

    await expect(
      getLiveQuizResetSummary({ quizId: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({ numOfResponses: 1 })
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

  it('rejects a ledger entry whose participation belongs to another participant', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    const otherParticipant = await prisma.participant.create({
      data: {
        username: uuidv4(),
        password: 'synthetic-test-password',
      },
    })
    const otherParticipation = await prisma.participation.create({
      data: {
        courseId: fixture.courseId!,
        participantId: otherParticipant.id,
        isActive: true,
      },
    })
    await prisma.liveQuizRewardEntry.updateMany({
      where: { rewardRunId: fixture.rewardRunId! },
      data: { participationId: otherParticipation.id },
    })

    await expect(
      getLiveQuizResetSummary({ quizId: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      eligible: false,
      reason: 'REWARD_DATA_UNAVAILABLE',
      legacyReconstructionStatus: 'UNAVAILABLE',
    })
  })

  it('atomically reverses rewards, clears run data, and preserves the quiz definition', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    const feedback = await prisma.feedback.findFirstOrThrow({
      where: { liveQuizId: fixture.liveQuizId },
    })
    await prisma.feedbackResponse.create({
      data: { content: 'Synthetic response', feedbackId: feedback.id },
    })
    const block = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: fixture.liveQuizId },
    })
    const scheduledAt = new Date('2026-08-10T12:00:00.000Z')
    await prisma.elementBlock.update({
      where: { id: block.id },
      data: {
        status: ElementBlockStatus.EXECUTED,
        startedAt: fixture.timelineDate,
        closedAt: fixture.timelineDate,
        expiresAt: fixture.timelineDate,
      },
    })
    await prisma.liveQuiz.update({
      where: { id: fixture.liveQuizId },
      data: {
        activeBlockId: block.id,
        availableFrom: scheduledAt,
        scheduledPublicationTaskId: 'synthetic-scheduled-task',
      },
    })
    await prisma.temporaryLeaderboardEntry.create({
      data: {
        id: uuidv4(),
        quizId: fixture.liveQuizId,
        username: 'Synthetic temporary participant',
        score: 1,
      },
    })
    const original = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.liveQuizId },
      include: { blocks: true },
    })

    const result = await resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)

    expect(result).toMatchObject({
      outcome: 'SUCCESS',
      rewardRunId: fixture.rewardRunId,
      totals: {
        coursePoints: fixture.awardedCoursePoints,
        participantXp: fixture.awardedParticipantXp,
        timelineChanges: 1,
        achievementChanges: fixture.awardedAchievementCount,
      },
    })
    const resetQuiz = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.liveQuizId },
      include: { blocks: true },
    })
    expect(resetQuiz).toMatchObject({
      id: fixture.liveQuizId,
      status: PublicationStatus.DRAFT,
      startedAt: null,
      finishedAt: null,
      availableFrom: null,
      scheduledPublicationTaskId: null,
      activeBlockId: null,
      activeRewardRunId: null,
      namespace: original.namespace,
      pinCode: original.pinCode,
      courseId: original.courseId,
      name: original.name,
      displayName: original.displayName,
      isGamificationEnabled: original.isGamificationEnabled,
      isAssessmentEnabled: original.isAssessmentEnabled,
    })
    expect(resetQuiz.blocks).toEqual([
      expect.objectContaining({
        status: ElementBlockStatus.SCHEDULED,
        startedAt: null,
        closedAt: null,
        expiresAt: null,
        execution: original.blocks[0]!.execution + 1,
      }),
    ])
    const [
      responses,
      feedbacks,
      feedbackResponses,
      confusionFeedbacks,
      sessionLeaderboardEntries,
      temporaryLeaderboardEntries,
      courseLeaderboard,
      participant,
      timelineEntries,
      achievement,
      rewardRun,
    ] = await Promise.all([
      prisma.liveQuizResponse.count({
        where: {
          instance: { elementBlock: { liveQuizId: fixture.liveQuizId } },
        },
      }),
      prisma.feedback.count({ where: { liveQuizId: fixture.liveQuizId } }),
      prisma.feedbackResponse.count({ where: { feedbackId: feedback.id } }),
      prisma.confusionTimestep.count({
        where: { liveQuizId: fixture.liveQuizId },
      }),
      prisma.leaderboardEntry.count({
        where: { liveQuizId: fixture.liveQuizId, type: 'SESSION' },
      }),
      prisma.temporaryLeaderboardEntry.count({
        where: { quizId: fixture.liveQuizId },
      }),
      prisma.leaderboardEntry.findUnique({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: fixture.participantId,
            courseId: fixture.courseId!,
          },
        },
      }),
      prisma.participant.findUniqueOrThrow({
        where: { id: fixture.participantId },
      }),
      prisma.timelineEntry.findMany({
        where: {
          participationId: fixture.participationId!,
          courseId: fixture.courseId!,
        },
      }),
      prisma.participantAchievementInstance.findUnique({
        where: {
          participantId_achievementId: {
            participantId: fixture.participantId,
            achievementId: fixture.achievementId!,
          },
        },
      }),
      prisma.liveQuizRewardRun.findUniqueOrThrow({
        where: { id: fixture.rewardRunId! },
      }),
    ])
    expect({
      responses,
      feedbacks,
      feedbackResponses,
      confusionFeedbacks,
      sessionLeaderboardEntries,
      temporaryLeaderboardEntries,
    }).toEqual({
      responses: 0,
      feedbacks: 0,
      feedbackResponses: 0,
      confusionFeedbacks: 0,
      sessionLeaderboardEntries: 0,
      temporaryLeaderboardEntries: 0,
    })
    expect(courseLeaderboard).toBeNull()
    expect(participant.xp).toBe(0)
    expect(timelineEntries).toEqual([])
    expect(achievement).toBeNull()
    expect(rewardRun).toMatchObject({
      status: LiveQuizRewardRunStatus.REVERSED,
      reversedById: userOneCtx.user.sub,
      reversedAt: expect.any(Date),
    })
  })

  it('allows an activity administrator to reset a regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
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
      resetLiveQuiz({ id: fixture.liveQuizId }, userTwoCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      activity: {
        id: fixture.liveQuizId,
        permissionLevel: PermissionLevel.ADMIN,
        isManager: true,
      },
    })
  })

  it('counts shared users when the implicit owner has no permission row', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await prisma.permission.create({
      data: {
        liveQuizId: fixture.liveQuizId,
        userId: userTwoCtx.user.sub,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: fixture.liveQuizId },
      prisma
    )
    await prisma.derivedPermission.deleteMany({
      where: {
        liveQuizId: fixture.liveQuizId,
        userId: userOneCtx.user.sub,
      },
    })
    expect(
      await prisma.derivedPermission.count({
        where: {
          liveQuizId: fixture.liveQuizId,
          userId: userOneCtx.user.sub,
        },
      })
    ).toBe(0)
    expect(
      await prisma.derivedPermission.count({
        where: { liveQuizId: fixture.liveQuizId },
      })
    ).toBe(1)

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      activity: {
        id: fixture.liveQuizId,
        permissionLevel: PermissionLevel.OWNER,
        numSharedUsers: 1,
      },
    })
  })

  it('allows an administrator derived through an activity group permission', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    const group = await prisma.userGroup.create({
      data: {
        name: `Synthetic reset administrators ${uuidv4()}`,
        ownerId: userOneCtx.user.sub,
        members: { connect: { id: userTwoCtx.user.sub } },
      },
    })
    await prisma.permission.create({
      data: {
        liveQuizId: fixture.liveQuizId,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: fixture.liveQuizId },
      prisma
    )

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userTwoCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      activity: {
        id: fixture.liveQuizId,
        permissionLevel: PermissionLevel.ADMIN,
        isManager: true,
        isRemovable: false,
      },
    })
  })

  it.each([
    PermissionLevel.READ,
    PermissionLevel.EXECUTE,
    PermissionLevel.WRITE,
  ])('rejects an activity caller with %s access', async (permissionLevel) => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await prisma.permission.create({
      data: {
        liveQuizId: fixture.liveQuizId,
        userId: userTwoCtx.user.sub,
        permissionLevel,
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: fixture.liveQuizId },
      prisma
    )

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userTwoCtx)
    ).rejects.toMatchObject({
      message: 'LIVE_QUIZ_RESET_FORBIDDEN',
      extensions: { code: 'FORBIDDEN' },
    })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({
        where: { id: fixture.liveQuizId },
      })
    ).resolves.toMatchObject({ status: PublicationStatus.ENDED })
  })

  it('rolls back the run transition and every reset mutation on reward underflow', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await prisma.participant.update({
      where: { id: fixture.participantId },
      data: { xp: fixture.awardedParticipantXp - 1 },
    })
    const before = {
      responses: await prisma.liveQuizResponse.count({
        where: {
          instance: { elementBlock: { liveQuizId: fixture.liveQuizId } },
        },
      }),
      feedbacks: await prisma.feedback.count({
        where: { liveQuizId: fixture.liveQuizId },
      }),
      courseLeaderboard: await prisma.leaderboardEntry.findUniqueOrThrow({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: fixture.participantId,
            courseId: fixture.courseId!,
          },
        },
      }),
    }

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'LIVE_QUIZ_PARTICIPANT_XP_UNDERFLOW' },
    })

    await expect(
      prisma.liveQuizRewardRun.findUniqueOrThrow({
        where: { id: fixture.rewardRunId! },
      })
    ).resolves.toMatchObject({ status: LiveQuizRewardRunStatus.APPLIED })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({
        where: { id: fixture.liveQuizId },
      })
    ).resolves.toMatchObject({
      status: PublicationStatus.ENDED,
      activeRewardRunId: fixture.rewardRunId,
    })
    expect(
      await prisma.liveQuizResponse.count({
        where: {
          instance: { elementBlock: { liveQuizId: fixture.liveQuizId } },
        },
      })
    ).toBe(before.responses)
    expect(
      await prisma.feedback.count({
        where: { liveQuizId: fixture.liveQuizId },
      })
    ).toBe(before.feedbacks)
    await expect(
      prisma.leaderboardEntry.findUniqueOrThrow({
        where: { id: before.courseLeaderboard.id },
      })
    ).resolves.toEqual(before.courseLeaderboard)
  })

  it.each([
    {
      reward: 'course points',
      code: 'LIVE_QUIZ_COURSE_REWARD_UNDERFLOW',
      corrupt: async (
        fixture: Awaited<ReturnType<typeof seedEndedRegularLiveQuizForReset>>
      ) => {
        await prisma.leaderboardEntry.update({
          where: {
            type_participantId_courseId: {
              type: 'COURSE',
              participantId: fixture.participantId,
              courseId: fixture.courseId!,
            },
          },
          data: { score: fixture.awardedCoursePoints - 1 },
        })
      },
    },
    {
      reward: 'timeline totals',
      code: 'LIVE_QUIZ_TIMELINE_REWARD_UNDERFLOW',
      corrupt: async (
        fixture: Awaited<ReturnType<typeof seedEndedRegularLiveQuizForReset>>
      ) => {
        await prisma.timelineEntry.update({
          where: {
            participationId_courseId_timestamp_type: {
              participationId: fixture.participationId!,
              courseId: fixture.courseId!,
              timestamp: fixture.timelineDate,
              type: 'DAILY',
            },
          },
          data: { collectedPoints: fixture.awardedTimelinePoints - 1 },
        })
      },
    },
    {
      reward: 'achievement count',
      code: 'LIVE_QUIZ_ACHIEVEMENT_REWARD_UNDERFLOW',
      corrupt: async (
        fixture: Awaited<ReturnType<typeof seedEndedRegularLiveQuizForReset>>
      ) => {
        await prisma.participantAchievementInstance.delete({
          where: {
            participantId_achievementId: {
              participantId: fixture.participantId,
              achievementId: fixture.achievementId!,
            },
          },
        })
      },
    },
  ])(
    'rolls back the attempted transition when $reward underflows',
    async ({ code, corrupt }) => {
      const fixture = await seedEndedRegularLiveQuizForReset(
        { gamified: true, withRewardRun: true },
        userOneCtx
      )
      await corrupt(fixture)

      await expect(
        resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
      ).rejects.toMatchObject({ extensions: { code } })
      await expect(
        prisma.liveQuizRewardRun.findUniqueOrThrow({
          where: { id: fixture.rewardRunId! },
        })
      ).resolves.toMatchObject({
        status: LiveQuizRewardRunStatus.APPLIED,
        reversedAt: null,
        reversedById: null,
      })
      await expect(
        prisma.liveQuiz.findUniqueOrThrow({
          where: { id: fixture.liveQuizId },
        })
      ).resolves.toMatchObject({
        status: PublicationStatus.ENDED,
        activeRewardRunId: fixture.rewardRunId,
      })
      expect(
        await prisma.liveQuizResponse.count({
          where: {
            instance: { elementBlock: { liveQuizId: fixture.liveQuizId } },
          },
        })
      ).toBe(1)
    }
  )

  it('reconstructs, persists, and reverses a complete legacy run in one reset', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      rewardRunId: expect.any(String),
      totals: {
        coursePoints: fixture.awardedCoursePoints,
        participantXp: fixture.awardedParticipantXp,
      },
    })
    await expect(
      prisma.liveQuizRewardRun.findFirstOrThrow({
        where: { liveQuizId: fixture.liveQuizId },
      })
    ).resolves.toMatchObject({
      status: LiveQuizRewardRunStatus.REVERSED,
      isLegacyReconstructed: true,
    })
  })

  it('resets a non-gamified regular quiz without a reward run', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      rewardRunId: null,
      totals: {
        coursePoints: 0,
        participantXp: 0,
        timelineChanges: 0,
        achievementChanges: 0,
      },
    })
  })

  it.each([
    PublicationStatus.DRAFT,
    PublicationStatus.SCHEDULED,
    PublicationStatus.PUBLISHED,
  ])('does not reset a regular quiz in %s state', async (status) => {
    const quiz = await seedLiveQuiz({ elements: [], status }, userOneCtx)

    await expect(resetLiveQuiz({ id: quiz.id }, userOneCtx)).resolves.toEqual({
      outcome: 'INVALID_STATE',
      activity: null,
    })
  })

  it('does not reset a deleted ended regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: fixture.liveQuizId },
      data: { isDeleted: true },
    })

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toEqual({
      outcome: 'INVALID_STATE',
      activity: null,
    })
  })

  it('returns reward data unavailable for an orphan ledger without resetting', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await prisma.liveQuizRewardEntry.updateMany({
      where: { rewardRunId: fixture.rewardRunId! },
      data: { participantId: null },
    })

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toEqual({
      outcome: 'REWARD_DATA_UNAVAILABLE',
      activity: null,
    })
    await expect(
      prisma.liveQuizRewardRun.findUniqueOrThrow({
        where: { id: fixture.rewardRunId! },
      })
    ).resolves.toMatchObject({ status: LiveQuizRewardRunStatus.APPLIED })
  })

  it('never reverses a reward run that belongs to another quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    const otherQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )
    const otherEndedAt = new Date()
    await prisma.liveQuiz.update({
      where: { id: otherQuiz.id },
      data: { finishedAt: otherEndedAt },
    })
    const otherRun = await prisma.liveQuizRewardRun.create({
      data: {
        liveQuizId: otherQuiz.id,
        endedAt: otherEndedAt,
      },
    })
    await prisma.liveQuiz.update({
      where: { id: fixture.liveQuizId },
      data: { activeRewardRunId: otherRun.id },
    })

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toEqual({
      outcome: 'REWARD_DATA_UNAVAILABLE',
      activity: null,
    })
    await expect(
      prisma.liveQuizRewardRun.findUniqueOrThrow({
        where: { id: otherRun.id },
      })
    ).resolves.toMatchObject({
      liveQuizId: otherQuiz.id,
      status: LiveQuizRewardRunStatus.APPLIED,
      reversedAt: null,
    })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({
        where: { id: fixture.liveQuizId },
      })
    ).resolves.toMatchObject({ status: PublicationStatus.ENDED })
  })

  it('returns one success and one conflict for concurrent reset attempts', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
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

    const [first, second] = await Promise.all([
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx),
      resetLiveQuiz({ id: fixture.liveQuizId }, userTwoCtx),
    ])

    expect([first.outcome, second.outcome].sort()).toEqual([
      'CONFLICT',
      'SUCCESS',
    ])
    expect(
      await prisma.liveQuizRewardRun.count({
        where: {
          liveQuizId: fixture.liveQuizId,
          status: LiveQuizRewardRunStatus.REVERSED,
        },
      })
    ).toBe(1)
  })

  it('exposes the authenticated reset summary and canonical mutation', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await recomputeDerivedPermissions(
      { liveQuizId: fixture.liveQuizId, userId: userOneCtx.user.sub },
      prisma
    )
    await prisma.feedback.updateMany({
      where: { liveQuizId: fixture.liveQuizId },
      data: { content: 'synthetic response content' },
    })
    const { audit } = mockResetDelivery(userOneCtx)

    const summaryResult = await graphql({
      schema,
      source: print(GetLiveQuizResetSummaryDocument),
      variableValues: { quizId: fixture.liveQuizId },
      contextValue: userOneCtx,
    })
    expect(summaryResult.errors).toBeUndefined()
    expect(summaryResult.data?.getLiveQuizResetSummary).toMatchObject({
      eligible: true,
      reason: 'ELIGIBLE',
      coursePointsToReverse: fixture.awardedCoursePoints,
      xpToReverse: fixture.awardedParticipantXp,
    })

    const resetResult = await graphql({
      schema,
      source: print(ResetLiveQuizDocument),
      variableValues: { id: fixture.liveQuizId },
      contextValue: userOneCtx,
    })
    expect(resetResult.errors).toBeUndefined()
    expect(resetResult.data?.resetLiveQuiz).toMatchObject({
      outcome: 'SUCCESS',
      activity: {
        id: fixture.liveQuizId,
        status: PublicationStatus.DRAFT,
      },
    })

    const auditEvents = audit.mock.calls
      .flatMap(([entries]) => entries)
      .map((entry) => JSON.parse(entry.message.info))
    const auditPayload = JSON.stringify(auditEvents)
    expect(auditPayload).toContain('LIVE_QUIZ_RESET_INITIATED')
    expect(auditPayload).toContain('LIVE_QUIZ_RESET_COMPLETED')
    expect(auditPayload).toContain('"outcome":"SUCCESS"')
    expect(auditPayload).not.toContain(fixture.participantId)
    expect(auditPayload).not.toContain('synthetic response content')
    expect(auditEvents).toEqual([
      expect.objectContaining({
        event: 'LIVE_QUIZ_RESET_INITIATED',
        operationId: expect.any(String),
        occurredAt: expect.any(String),
        sequence: 1,
      }),
      expect.objectContaining({
        event: 'LIVE_QUIZ_RESET_COMPLETED',
        operationId: expect.any(String),
        occurredAt: expect.any(String),
        sequence: 2,
      }),
    ])
    expect(auditEvents[1]!.operationId).toBe(auditEvents[0]!.operationId)
    expect(Date.parse(auditEvents[0]!.occurredAt)).not.toBeNaN()
    expect(Date.parse(auditEvents[1]!.occurredAt)).not.toBeNaN()
  })

  it.each([
    {
      expectedOutcome: 'INVALID_STATE',
      prepare: async () => {
        const quiz = await seedLiveQuiz(
          { elements: [], status: PublicationStatus.DRAFT },
          userOneCtx
        )
        return quiz.id
      },
    },
    {
      expectedOutcome: 'REWARD_DATA_UNAVAILABLE',
      prepare: async () => {
        const fixture = await seedEndedRegularLiveQuizForReset(
          { gamified: true, withRewardRun: true },
          userOneCtx
        )
        await prisma.liveQuizRewardEntry.updateMany({
          where: { rewardRunId: fixture.rewardRunId! },
          data: { participantId: null },
        })
        return fixture.liveQuizId
      },
    },
  ])(
    'returns structured $expectedOutcome through the canonical mutation',
    async ({ expectedOutcome, prepare }) => {
      const id = await prepare()
      await recomputeDerivedPermissions(
        { liveQuizId: id, userId: userOneCtx.user.sub },
        prisma
      )
      mockResetDelivery(userOneCtx)

      const result = await graphql({
        schema,
        source: print(ResetLiveQuizDocument),
        variableValues: { id },
        contextValue: userOneCtx,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.resetLiveQuiz).toEqual({
        outcome: expectedOutcome,
        activity: null,
      })
    }
  )

  it('returns one SUCCESS and one CONFLICT through concurrent canonical mutations', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
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
    mockResetDelivery(userOneCtx)

    const [first, second] = await Promise.all([
      graphql({
        schema,
        source: print(ResetLiveQuizDocument),
        variableValues: { id: fixture.liveQuizId },
        contextValue: userOneCtx,
      }),
      graphql({
        schema,
        source: print(ResetLiveQuizDocument),
        variableValues: { id: fixture.liveQuizId },
        contextValue: userTwoCtx,
      }),
    ])

    expect(first.errors).toBeUndefined()
    expect(second.errors).toBeUndefined()
    const outcomes = [first, second]
      .map(
        (result) =>
          (result.data?.resetLiveQuiz as { outcome: string } | null | undefined)
            ?.outcome
      )
      .sort()
    expect(outcomes).toEqual(['CONFLICT', 'SUCCESS'])
  })

  it('rejects an unauthenticated canonical reset at the schema boundary', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )

    const result = await graphql({
      schema,
      source: print(ResetLiveQuizDocument),
      variableValues: { id: fixture.liveQuizId },
      contextValue: { ...userOneCtx, user: undefined },
    })

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: fixture.liveQuizId } })
    ).resolves.toMatchObject({ status: PublicationStatus.ENDED })
  })

  it('blocks the reset when initiation audit scheduling fails', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await userOneCtx.redisExec.set(
      `lq:${fixture.liveQuizId}:synthetic`,
      'preserved'
    )
    const { audit } = mockResetDelivery(userOneCtx)
    audit.mockRejectedValueOnce(new Error('synthetic audit outage'))

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).rejects.toThrow('synthetic audit outage')
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: fixture.liveQuizId } })
    ).resolves.toMatchObject({ status: PublicationStatus.ENDED })
    await expect(
      userOneCtx.redisExec.get(`lq:${fixture.liveQuizId}:synthetic`)
    ).resolves.toBe('preserved')
  })

  it('audits unexpected failures without exception or participant data', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    const { audit } = mockResetDelivery(userOneCtx)

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).rejects.toThrow(
      'Invalid element type encountered during result initialization'
    )
    const auditPayload = JSON.stringify(audit.mock.calls)
    expect(auditPayload).toContain('LIVE_QUIZ_RESET_FAILED')
    expect(auditPayload).toContain('UNEXPECTED_RESET_FAILURE')
    expect(auditPayload).not.toContain(
      'Invalid element type encountered during result initialization'
    )
    expect(auditPayload).not.toContain(fixture.participantId)
  })

  it('schedules idempotent cleanup after synchronous Redis cleanup fails', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await userOneCtx.redisExec.set(
      `lq:${fixture.liveQuizId}:synthetic`,
      'stale'
    )
    const { cleanup } = mockResetDelivery(userOneCtx)
    vi.spyOn(userOneCtx.redisExec, 'scan').mockRejectedValueOnce(
      new Error('synthetic Redis outage')
    )

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({ outcome: 'SUCCESS' })
    expect(cleanup).toHaveBeenCalledWith([
      {
        liveQuizId: fixture.liveQuizId,
        isAssessmentEnabled: false,
        cacheGenerationSnapshot: {
          status: 'AVAILABLE',
          generation: null,
        },
        weeklyTimelineRecomputations: [
          expect.objectContaining({
            participationId: fixture.participationId,
            courseId: fixture.courseId,
            weekStart: expect.any(String),
          }),
        ],
      },
    ])
  })

  it('schedules cleanup after historical-week recomputation fails', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    const { cleanup } = mockResetDelivery(userOneCtx)
    const failingPrisma = prisma.$extends({
      query: {
        timelineEntry: {
          aggregate() {
            throw new Error('synthetic historical aggregation outage')
          },
        },
      },
    })

    await expect(
      resetLiveQuiz(
        { id: fixture.liveQuizId },
        { ...userOneCtx, prisma: failingPrisma as unknown as PrismaClient }
      )
    ).resolves.toMatchObject({ outcome: 'SUCCESS' })
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('keeps committed success when completion audit scheduling fails', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    const { audit } = mockResetDelivery(userOneCtx)
    audit
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('synthetic completion audit outage'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({ outcome: 'SUCCESS' })
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to deliver live quiz reset audit'
    )
  })

  it('keeps committed success when cache invalidation listeners throw', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withRewardRun: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    mockResetDelivery(userOneCtx)
    vi.spyOn(userOneCtx.emitter, 'emit').mockImplementationOnce(() => {
      throw new Error('synthetic invalidation listener outage')
    })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({ outcome: 'SUCCESS' })
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to deliver live quiz reset invalidation'
    )
  })

  it('clears stale regular draft execution keys before writing fresh metadata', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    await userOneCtx.redisExec.hset(`lq:${quiz.id}:meta`, {
      namespace: 'stale-namespace',
      startedAt: 1,
    })
    await userOneCtx.redisExec.set(`lq:${quiz.id}:synthetic`, 'stale')

    await expect(
      startLiveQuiz({ id: quiz.id }, userOneCtx)
    ).resolves.toMatchObject({
      id: quiz.id,
      status: PublicationStatus.PUBLISHED,
    })
    await expect(
      userOneCtx.redisExec.get(`lq:${quiz.id}:synthetic`)
    ).resolves.toBeNull()
    await expect(
      userOneCtx.redisExec.hget(`lq:${quiz.id}:meta`, 'namespace')
    ).resolves.toBe(quiz.namespace)
  })

  it('does not publish a regular draft when clean-start deletion fails', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    await userOneCtx.redisExec.set(`lq:${quiz.id}:synthetic`, 'stale')
    vi.spyOn(userOneCtx.redisExec, 'scan').mockRejectedValueOnce(
      new Error('synthetic clean-start outage')
    )

    await expect(startLiveQuiz({ id: quiz.id }, userOneCtx)).rejects.toThrow(
      'synthetic clean-start outage'
    )
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).resolves.toMatchObject({ status: PublicationStatus.DRAFT })
    await expect(
      userOneCtx.redisExec.get(`lq:${quiz.id}:synthetic`)
    ).resolves.toBe('stale')
  })

  it('serializes concurrent manual starts without clearing the winning run', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const control = controlLiveQuizCacheInitialization(userOneCtx, quiz.id)
    const controlledCtx = { ...userOneCtx, redisExec: control.redis }

    const winner = startLiveQuiz({ id: quiz.id }, controlledCtx)
    await control.waitUntilInitialized()
    const loser = startLiveQuiz({ id: quiz.id }, controlledCtx)
    control.allowCompletion()

    await expect(Promise.all([winner, loser])).resolves.toEqual([
      expect.objectContaining({ status: PublicationStatus.PUBLISHED }),
      expect.objectContaining({ status: PublicationStatus.PUBLISHED }),
    ])
    expect(control.getInitializationCount()).toBe(1)
    await expect(
      userOneCtx.redisExec.hget(`lq:${quiz.id}:meta`, 'cacheGeneration')
    ).resolves.toEqual(expect.any(String))
    await expect(userOneCtx.redisExec.get(control.sentinelKey)).resolves.toBe(
      'preserved'
    )
  })

  it('serializes concurrent manual and scheduled starts without clearing the winning run', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.SCHEDULED },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: quiz.id },
      data: { availableFrom: new Date(Date.now() - 60_000) },
    })
    const control = controlLiveQuizCacheInitialization(userOneCtx, quiz.id)
    const controlledCtx = { ...userOneCtx, redisExec: control.redis }

    const manualWinner = startLiveQuiz({ id: quiz.id }, controlledCtx)
    await control.waitUntilInitialized()
    const scheduledLoser = handlePublishScheduledLiveQuiz(
      { liveQuizId: quiz.id },
      globalHandlerContext(controlledCtx),
      { logger: { info: vi.fn() } } as never
    )
    control.allowCompletion()

    await expect(manualWinner).resolves.toMatchObject({
      status: PublicationStatus.PUBLISHED,
      scheduledPublicationTaskId: null,
    })
    await expect(scheduledLoser).resolves.toBe(true)
    expect(control.getInitializationCount()).toBe(1)
    await expect(
      userOneCtx.redisExec.hget(`lq:${quiz.id}:meta`, 'cacheGeneration')
    ).resolves.toEqual(expect.any(String))
    await expect(userOneCtx.redisExec.get(control.sentinelKey)).resolves.toBe(
      'preserved'
    )
  })

  it('fences delayed cleanup from a newly started manual run', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const previousGeneration = uuidv4()
    await userOneCtx.redisExec.hset(`lq:${quiz.id}:meta`, {
      namespace: quiz.namespace,
      cacheGeneration: previousGeneration,
    })

    await startLiveQuiz({ id: quiz.id }, userOneCtx)
    const newGeneration = await userOneCtx.redisExec.hget(
      `lq:${quiz.id}:meta`,
      'cacheGeneration'
    )
    expect(newGeneration).toEqual(expect.any(String))
    expect(newGeneration).not.toBe(previousGeneration)
    await userOneCtx.redisExec.set(`lq:${quiz.id}:new-run`, 'preserved')

    await clearLiveQuizExecutionCache({
      liveQuizId: quiz.id,
      redis: userOneCtx.redisExec,
      cacheGenerationSnapshot: {
        status: 'AVAILABLE',
        generation: previousGeneration,
      },
    })

    await expect(
      userOneCtx.redisExec.hget(`lq:${quiz.id}:meta`, 'cacheGeneration')
    ).resolves.toBe(newGeneration)
    await expect(
      userOneCtx.redisExec.get(`lq:${quiz.id}:new-run`)
    ).resolves.toBe('preserved')
  })

  it('initializes scheduled starts with a fresh generation after stale cleanup', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.SCHEDULED },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: quiz.id },
      data: { availableFrom: new Date(Date.now() - 60_000) },
    })
    await userOneCtx.redisExec.set(`lq:${quiz.id}:synthetic`, 'stale')

    await expect(
      handlePublishScheduledLiveQuiz(
        { liveQuizId: quiz.id },
        globalHandlerContext(userOneCtx),
        { logger: { info: vi.fn() } } as never
      )
    ).resolves.toBe(true)
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    await expect(
      userOneCtx.redisExec.get(`lq:${quiz.id}:synthetic`)
    ).resolves.toBeNull()
    await expect(
      userOneCtx.redisExec.hget(`lq:${quiz.id}:meta`, 'cacheGeneration')
    ).resolves.toEqual(expect.any(String))
  })

  it('does not publish a scheduled quiz when stale cleanup fails', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.SCHEDULED },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: quiz.id },
      data: { availableFrom: new Date(Date.now() - 60_000) },
    })
    vi.spyOn(userOneCtx.redisExec, 'scan').mockRejectedValueOnce(
      new Error('synthetic scheduled clean-start outage')
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      handlePublishScheduledLiveQuiz(
        { liveQuizId: quiz.id },
        globalHandlerContext(userOneCtx),
        { logger: { info: vi.fn() } } as never
      )
    ).rejects.toThrow('synthetic scheduled clean-start outage')
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).resolves.toMatchObject({ status: PublicationStatus.SCHEDULED })
  })

  it('cleans a legacy generation in the reset-time realm idempotently', async () => {
    const liveQuizId = uuidv4()
    for (const redis of [
      userOneCtx.redisExec,
      userOneCtx.redisAssessmentExec,
    ]) {
      await redis.hset(`lq:${liveQuizId}:meta`, {
        namespace: 'legacy-namespace',
      })
      await redis.set(`lq:${liveQuizId}:synthetic`, 'stale')
    }
    const input = {
      liveQuizId,
      isAssessmentEnabled: true,
      cacheGenerationSnapshot: {
        status: 'AVAILABLE' as const,
        generation: null,
      },
      weeklyTimelineRecomputations: [],
    }

    await expect(
      handleCleanupLiveQuizResetCache(
        input,
        globalHandlerContext(userOneCtx),
        {} as never
      )
    ).resolves.toBe(true)
    await expect(
      handleCleanupLiveQuizResetCache(
        input,
        globalHandlerContext(userOneCtx),
        {} as never
      )
    ).resolves.toBe(true)
    await expect(
      userOneCtx.redisAssessmentExec.get(`lq:${liveQuizId}:synthetic`)
    ).resolves.toBeNull()
    await expect(
      userOneCtx.redisExec.get(`lq:${liveQuizId}:synthetic`)
    ).resolves.toBe('stale')
  })

  it('recomputes historical weeks even after the quiz has been deleted', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    const weekStart = new Date('2026-07-27T00:00:00.000Z')
    await prisma.timelineEntry.create({
      data: {
        participationId: fixture.participationId!,
        courseId: fixture.courseId!,
        type: TimelineEntryType.WEEKLY,
        timestamp: weekStart,
        collectedPoints: 999,
        collectedXp: 999,
      },
    })
    await prisma.liveQuiz.delete({ where: { id: fixture.liveQuizId } })

    await handleCleanupLiveQuizResetCache(
      {
        liveQuizId: fixture.liveQuizId,
        isAssessmentEnabled: false,
        cacheGenerationSnapshot: { status: 'UNAVAILABLE' },
        weeklyTimelineRecomputations: [
          {
            participationId: fixture.participationId!,
            courseId: fixture.courseId!,
            weekStart: fixture.timelineDate.toISOString(),
          },
        ],
      },
      globalHandlerContext(userOneCtx),
      {} as never
    )

    await expect(
      prisma.timelineEntry.findUniqueOrThrow({
        where: {
          participationId_courseId_timestamp_type: {
            participationId: fixture.participationId!,
            courseId: fixture.courseId!,
            timestamp: weekStart,
            type: TimelineEntryType.WEEKLY,
          },
        },
      })
    ).resolves.toMatchObject({
      collectedPoints: fixture.awardedTimelinePoints,
      collectedXp: fixture.awardedTimelineXp,
    })
  })

  it('skips unsafe cache deletion when generation snapshotting fails', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await userOneCtx.redisExec.set(
      `lq:${fixture.liveQuizId}:synthetic`,
      'preserved-until-clean-start'
    )
    const { cleanup } = mockResetDelivery(userOneCtx)
    vi.spyOn(userOneCtx.redisExec, 'hget').mockRejectedValueOnce(
      new Error('synthetic generation snapshot outage')
    )

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({ outcome: 'SUCCESS' })
    expect(cleanup).not.toHaveBeenCalled()
    await expect(
      userOneCtx.redisExec.get(`lq:${fixture.liveQuizId}:synthetic`)
    ).resolves.toBe('preserved-until-clean-start')
  })
})
