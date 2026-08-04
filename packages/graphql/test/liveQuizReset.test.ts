import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementBlockStatus,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import type { ElementData, ElementInstanceResults } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { graphql, print } from 'graphql/index.js'
import { v4 as uuidv4 } from 'uuid'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { ResetLiveQuizDocument } from '../src/ops.js'
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
  type LiveQuizResetFixture,
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

  async function readCumulativeRewardSnapshot(fixture: LiveQuizResetFixture) {
    const [
      courseLeaderboard,
      participant,
      participation,
      timelineEntries,
      achievement,
      awards,
      performance,
    ] = await Promise.all([
      fixture.courseId
        ? prisma.leaderboardEntry.findUnique({
            where: {
              type_participantId_courseId: {
                type: 'COURSE',
                participantId: fixture.participantId,
                courseId: fixture.courseId,
              },
            },
          })
        : null,
      prisma.participant.findUniqueOrThrow({
        where: { id: fixture.participantId },
        include: { titles: true },
      }),
      fixture.participationId
        ? prisma.participation.findUniqueOrThrow({
            where: { id: fixture.participationId },
          })
        : null,
      fixture.participationId && fixture.courseId
        ? prisma.timelineEntry.findMany({
            where: {
              participationId: fixture.participationId,
              courseId: fixture.courseId,
            },
            orderBy: { id: 'asc' },
          })
        : [],
      fixture.achievementId
        ? prisma.participantAchievementInstance.findUnique({
            where: {
              participantId_achievementId: {
                participantId: fixture.participantId,
                achievementId: fixture.achievementId,
              },
            },
          })
        : null,
      prisma.awardEntry.findMany({
        where: { participantId: fixture.participantId },
        orderBy: { id: 'asc' },
      }),
      fixture.courseId
        ? prisma.participantPerformance.findUnique({
            where: {
              participantId_courseId: {
                participantId: fixture.participantId,
                courseId: fixture.courseId,
              },
            },
          })
        : null,
    ])

    return {
      courseLeaderboard,
      participant,
      participation,
      timelineEntries,
      achievement,
      awards,
      performance,
    }
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
      { gamified: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await prisma.temporaryLeaderboardEntry.create({
      data: {
        id: uuidv4(),
        quizId: fixture.liveQuizId,
        username: 'Synthetic temporary summary participant',
        score: 2,
      },
    })

    const summary = await getLiveQuizResetSummary(
      { quizId: fixture.liveQuizId },
      userOneCtx
    )

    expect(summary).toEqual({
      eligible: true,
      reason: 'ELIGIBLE',
      numOfResponses: 1,
      numOfFeedbacks: 1,
      numOfConfusionFeedbacks: 1,
      numOfLeaderboardEntries: 2,
    })
  })

  it('counts aggregate-only responses when they exceed persisted rows', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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
      eligible: false,
      reason: 'ASSESSMENT_POLICY',
    })
    await expect(
      getLiveQuizResetSummary({ quizId: quiz.id }, userTwoCtx)
    ).resolves.toMatchObject({
      eligible: false,
      reason: 'ASSESSMENT_POLICY',
    })
    await expect(
      getLiveQuizResetSummary({ quizId: quiz.id }, userThreeCtx)
    ).resolves.toBeNull()
  })

  it('deletes run data and preserves cumulative rewards exactly', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true },
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
        startedAt: fixture.timelineDate,
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
        score: 3,
      },
    })
    const original = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.liveQuizId },
      include: { blocks: { include: { elements: true } } },
    })
    const cumulativeBefore = await readCumulativeRewardSnapshot(fixture)
    expect(cumulativeBefore.courseLeaderboard).toMatchObject({
      type: 'COURSE',
      liveQuizId: fixture.liveQuizId,
      score: fixture.awardedCoursePoints,
    })
    expect(cumulativeBefore.participant).toMatchObject({
      xp: fixture.awardedParticipantXp,
      titles: [expect.objectContaining({ courseId: fixture.courseId })],
    })
    expect(cumulativeBefore.performance).toMatchObject({
      firstErrorRate: 0.8,
      firstPerformance: 'LOW',
      lastErrorRate: 0.5,
      lastPerformance: 'MEDIUM',
      totalErrorRate: 0.2,
      totalPerformance: 'HIGH',
    })

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      activity: { id: fixture.liveQuizId, status: PublicationStatus.DRAFT },
    })
    expect(await readCumulativeRewardSnapshot(fixture)).toEqual(
      cumulativeBefore
    )
    const resetQuiz = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.liveQuizId },
      include: { blocks: { include: { elements: true } } },
    })
    expect(resetQuiz).toMatchObject({
      id: original.id,
      status: PublicationStatus.DRAFT,
      startedAt: null,
      finishedAt: null,
      availableFrom: null,
      scheduledPublicationTaskId: null,
      activeBlockId: null,
      namespace: original.namespace,
      pinCode: original.pinCode,
      courseId: original.courseId,
      name: original.name,
      displayName: original.displayName,
      description: original.description,
      isGamificationEnabled: original.isGamificationEnabled,
      isAssessmentEnabled: original.isAssessmentEnabled,
    })
    const originalBlock = original.blocks[0]!
    const resetBlock = resetQuiz.blocks[0]!
    expect(resetBlock).toMatchObject({
      id: originalBlock.id,
      order: originalBlock.order,
      status: ElementBlockStatus.SCHEDULED,
      startedAt: null,
      closedAt: null,
      expiresAt: null,
      execution: originalBlock.execution + 1,
    })
    const originalInstance = originalBlock.elements[0]!
    const resetInstance = resetBlock.elements[0]!
    expect(resetInstance).toMatchObject({
      id: originalInstance.id,
      order: originalInstance.order,
      elementId: originalInstance.elementId,
      type: originalInstance.type,
      elementType: originalInstance.elementType,
      options: originalInstance.options,
      elementData: originalInstance.elementData,
      results: { choices: {}, total: 0 },
      anonymousResults: { choices: {}, total: 0 },
    })
    const [
      responses,
      feedbacks,
      feedbackResponses,
      confusionFeedbacks,
      sessionLeaderboardEntries,
      temporaryLeaderboardEntries,
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
  })

  it('allows an activity administrator to reset a regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: false },
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
        isActivityReviewer: true,
      },
    })
  })

  it('does not grant course-reviewer status to an activity owner', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: true },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)
    await prisma.course.update({
      where: { id: fixture.courseId! },
      data: { ownerId: userTwoCtx.user.sub },
    })

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      activity: {
        id: fixture.liveQuizId,
        isActivityReviewer: false,
      },
    })
  })

  it('counts shared users when the implicit owner has no permission row', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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

  it('resets a non-gamified standalone regular quiz', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: false },
      userOneCtx
    )
    await makeFixtureInstanceResettable(fixture.instanceId)

    await expect(
      resetLiveQuiz({ id: fixture.liveQuizId }, userOneCtx)
    ).resolves.toMatchObject({
      outcome: 'SUCCESS',
      activity: { id: fixture.liveQuizId, status: PublicationStatus.DRAFT },
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
      { gamified: false, withCourse: false },
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

  it('rejects an ended assessment quiz through the regular reset service', async () => {
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
    const before = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: quiz.id },
    })

    await expect(resetLiveQuiz({ id: quiz.id }, userOneCtx)).resolves.toEqual({
      outcome: 'INVALID_STATE',
      activity: null,
    })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).resolves.toEqual(before)
  })

  it('returns one success and one invalid state for concurrent reset attempts', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true },
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
      'INVALID_STATE',
      'SUCCESS',
    ])
  })

  it('exposes the authenticated reset summary and canonical mutation', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true },
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
      source: `
        query GetLiveQuizResetSummary($quizId: String!) {
          getLiveQuizResetSummary(quizId: $quizId) {
            numOfResponses
            numOfFeedbacks
            numOfConfusionFeedbacks
            numOfLeaderboardEntries
            eligible
            reason
          }
        }
      `,
      variableValues: { quizId: fixture.liveQuizId },
      contextValue: userOneCtx,
    })
    expect(summaryResult.errors).toBeUndefined()
    expect(summaryResult.data?.getLiveQuizResetSummary).toEqual({
      eligible: true,
      reason: 'ELIGIBLE',
      numOfResponses: 1,
      numOfFeedbacks: 1,
      numOfConfusionFeedbacks: 1,
      numOfLeaderboardEntries: 1,
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
    for (const rewardField of [
      'rewardRunId',
      'coursePoints',
      'participantXp',
      'timelineChanges',
      'achievementChanges',
    ]) {
      expect(auditPayload).not.toContain(rewardField)
    }
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

  it('returns structured INVALID_STATE through the canonical mutation', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: false },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: fixture.liveQuizId },
      data: { status: PublicationStatus.DRAFT },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: fixture.liveQuizId, userId: userOneCtx.user.sub },
      prisma
    )
    const { audit } = mockResetDelivery(userOneCtx)

    const result = await graphql({
      schema,
      source: print(ResetLiveQuizDocument),
      variableValues: { id: fixture.liveQuizId },
      contextValue: userOneCtx,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.resetLiveQuiz).toEqual({
      outcome: 'INVALID_STATE',
      activity: null,
    })
    const auditEvents = audit.mock.calls
      .flatMap(([entries]) => entries)
      .map((entry) => JSON.parse(entry.message.info))
    expect(auditEvents).toEqual([
      expect.objectContaining({
        event: 'LIVE_QUIZ_RESET_INITIATED',
        sequence: 1,
      }),
      expect.objectContaining({
        event: 'LIVE_QUIZ_RESET_BLOCKED',
        outcome: 'INVALID_STATE',
        sequence: 2,
      }),
    ])
    const auditPayload = JSON.stringify(auditEvents)
    expect(auditPayload).not.toContain(fixture.participantId)
    for (const rewardField of [
      'rewardRunId',
      'coursePoints',
      'participantXp',
      'timelineChanges',
      'achievementChanges',
    ]) {
      expect(auditPayload).not.toContain(rewardField)
    }
  })

  it('rejects an ended assessment quiz through the canonical mutation', async () => {
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
    await recomputeDerivedPermissions(
      { liveQuizId: quiz.id, userId: userOneCtx.user.sub },
      prisma
    )
    mockResetDelivery(userOneCtx)
    const before = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: quiz.id },
    })

    const result = await graphql({
      schema,
      source: print(ResetLiveQuizDocument),
      variableValues: { id: quiz.id },
      contextValue: userOneCtx,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.resetLiveQuiz).toEqual({
      outcome: 'INVALID_STATE',
      activity: null,
    })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).resolves.toEqual(before)
  })

  it('returns one SUCCESS and one INVALID_STATE through concurrent canonical mutations', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true },
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
    expect(outcomes).toEqual(['INVALID_STATE', 'SUCCESS'])
  })

  it('rejects an unauthenticated canonical reset at the schema boundary', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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
      { gamified: true },
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
      },
    ])
  })

  it('keeps committed success when completion audit scheduling fails', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: false, withCourse: false },
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
      { gamified: false, withCourse: false },
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
    }

    await expect(
      handleCleanupLiveQuizResetCache(input, globalHandlerContext(userOneCtx))
    ).resolves.toBe(true)
    await expect(
      handleCleanupLiveQuizResetCache(input, globalHandlerContext(userOneCtx))
    ).resolves.toBe(true)
    await expect(
      userOneCtx.redisAssessmentExec.get(`lq:${liveQuizId}:synthetic`)
    ).resolves.toBeNull()
    await expect(
      userOneCtx.redisExec.get(`lq:${liveQuizId}:synthetic`)
    ).resolves.toBe('stale')
  })

  it('clears orphaned cache for a soft-deleted quiz', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )
    await userOneCtx.redisExec.hset(`lq:${quiz.id}:meta`, {
      cacheGeneration: uuidv4(),
    })
    await userOneCtx.redisExec.set(`lq:${quiz.id}:synthetic`, 'orphaned')
    await prisma.liveQuiz.update({
      where: { id: quiz.id },
      data: { isDeleted: true },
    })

    await expect(
      handleCleanupLiveQuizResetCache(
        {
          liveQuizId: quiz.id,
          isAssessmentEnabled: false,
          cacheGenerationSnapshot: { status: 'UNAVAILABLE' },
        },
        globalHandlerContext(userOneCtx)
      )
    ).resolves.toBe(true)
    await expect(
      userOneCtx.redisExec.hget(`lq:${quiz.id}:meta`, 'cacheGeneration')
    ).resolves.toBeNull()
    await expect(
      userOneCtx.redisExec.get(`lq:${quiz.id}:synthetic`)
    ).resolves.toBeNull()
  })

  it('schedules generation-safe cleanup when generation snapshotting fails', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true },
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
    expect(cleanup).toHaveBeenCalledTimes(1)
    const cleanupInput = cleanup.mock.calls[0]![0][0]!
    expect(cleanupInput).toEqual({
      liveQuizId: fixture.liveQuizId,
      isAssessmentEnabled: false,
      cacheGenerationSnapshot: { status: 'UNAVAILABLE' },
    })
    await expect(
      userOneCtx.redisExec.get(`lq:${fixture.liveQuizId}:synthetic`)
    ).resolves.toBe('preserved-until-clean-start')

    await handleCleanupLiveQuizResetCache(
      cleanupInput,
      globalHandlerContext(userOneCtx)
    )
    await expect(
      userOneCtx.redisExec.get(`lq:${fixture.liveQuizId}:synthetic`)
    ).resolves.toBeNull()
  })

  it('fences unavailable-snapshot cleanup from a newly started run', async () => {
    const quiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )

    await startLiveQuiz({ id: quiz.id }, userOneCtx)
    const newGeneration = await userOneCtx.redisExec.hget(
      `lq:${quiz.id}:meta`,
      'cacheGeneration'
    )
    await userOneCtx.redisExec.set(`lq:${quiz.id}:new-run`, 'preserved')

    await expect(
      handleCleanupLiveQuizResetCache(
        {
          liveQuizId: quiz.id,
          isAssessmentEnabled: false,
          cacheGenerationSnapshot: { status: 'UNAVAILABLE' },
        },
        globalHandlerContext(userOneCtx)
      )
    ).resolves.toBe(true)
    await expect(
      userOneCtx.redisExec.hget(`lq:${quiz.id}:meta`, 'cacheGeneration')
    ).resolves.toBe(newGeneration)
    await expect(
      userOneCtx.redisExec.get(`lq:${quiz.id}:new-run`)
    ).resolves.toBe('preserved')
  })
})
