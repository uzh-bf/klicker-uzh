import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  AchievementScope,
  AchievementType,
  ElementType,
  LiveQuizRewardRunStatus,
  PrismaClient,
  PublicationStatus,
  ResponseCorrectness,
  TimelineEntryType,
} from '@klicker-uzh/prisma/client'
import { processElementData } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  calculateLiveQuizRewardPlan,
  inspectLegacyRegularLiveQuizRewards,
  persistLiveQuizRewardRun,
  type LiveQuizRewardParticipant,
} from '../src/services/liveQuizRewards.js'
import { endLiveQuiz } from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedCourse,
  seedElements,
  seedEndedRegularLiveQuizForReset,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('calculateLiveQuizRewardPlan', () => {
  const achievements = {
    first: { id: 1, rewardedPoints: 30, rewardedXP: 15 },
    second: { id: 2, rewardedPoints: 20, rewardedXP: 10 },
    third: { id: 3, rewardedPoints: 10, rewardedXP: 5 },
  }
  const endedAt = new Date('2026-07-30T10:00:00.000Z')

  it('records base and rank rewards as the exact applied totals', () => {
    const participants: LiveQuizRewardParticipant[] = [
      {
        participantId: '00000000-0000-0000-0000-000000000001',
        participationId: 11,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 100,
        xp: 40,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000002',
        participationId: 12,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 80,
        xp: 30,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000003',
        participationId: 13,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 60,
        xp: 20,
      },
    ]

    expect(
      calculateLiveQuizRewardPlan({
        participants,
        achievements,
        awardAchievements: true,
        endedAt,
      })
    ).toEqual({
      endedAt,
      isLegacyReconstructed: false,
      entries: [
        expect.objectContaining({
          participantId: participants[0]!.participantId,
          coursePointsAwarded: 130,
          participantXpAwarded: 55,
          achievementId: 1,
          achievementCountAwarded: 1,
        }),
        expect.objectContaining({
          participantId: participants[1]!.participantId,
          coursePointsAwarded: 100,
          participantXpAwarded: 40,
          achievementId: 2,
          achievementCountAwarded: 1,
        }),
        expect.objectContaining({
          participantId: participants[2]!.participantId,
          coursePointsAwarded: 70,
          participantXpAwarded: 25,
          achievementId: 3,
          achievementCountAwarded: 1,
        }),
      ],
    })
  })

  it('awards tied ranks once and does not create an achievement for missing XP', () => {
    const participants: LiveQuizRewardParticipant[] = [
      {
        participantId: '00000000-0000-0000-0000-000000000001',
        participationId: 11,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 100,
        xp: 40,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000002',
        participationId: 12,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 100,
        xp: 20,
      },
      {
        participantId: '00000000-0000-0000-0000-000000000003',
        participationId: 13,
        courseId: '00000000-0000-0000-0000-000000000010',
        hasActiveParticipation: true,
        isCourseGamificationEnabled: true,
        score: 80,
      },
    ]

    const plan = calculateLiveQuizRewardPlan({
      participants,
      achievements,
      awardAchievements: true,
      endedAt,
    })

    expect(plan.entries.map((entry) => entry.achievementId)).toEqual([
      1,
      1,
      null,
    ])
  })

  it('keeps XP and timeline rewards for inactive course participants without course points', () => {
    const participant: LiveQuizRewardParticipant = {
      participantId: '00000000-0000-0000-0000-000000000001',
      participationId: 11,
      courseId: '00000000-0000-0000-0000-000000000010',
      hasActiveParticipation: false,
      isCourseGamificationEnabled: true,
      score: 100,
      xp: 40,
    }

    expect(
      calculateLiveQuizRewardPlan({
        participants: [participant],
        awardAchievements: false,
        endedAt,
      }).entries[0]
    ).toMatchObject({
      participantId: participant.participantId,
      coursePointsAwarded: 0,
      participantXpAwarded: 40,
      timelineDate: endedAt,
      timelinePointsAwarded: 0,
      timelineXpAwarded: 40,
    })
  })

  it('does not persist an achievement increment without a linked course', () => {
    const participant: LiveQuizRewardParticipant = {
      participantId: '00000000-0000-0000-0000-000000000001',
      participationId: null,
      courseId: null,
      hasActiveParticipation: false,
      isCourseGamificationEnabled: false,
      score: 100,
      xp: 40,
    }

    expect(
      calculateLiveQuizRewardPlan({
        participants: [participant],
        achievements,
        awardAchievements: true,
        endedAt,
      }).entries[0]
    ).toMatchObject({
      participantId: participant.participantId,
      participantXpAwarded: 55,
      achievementId: null,
      achievementCountAwarded: 0,
    })
  })
})

describe('regular live quiz reward ledger integration', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser

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
    await userOneCtx.redisExec.flushdb()
    await userOneCtx.redisAssessmentExec.flushdb()
    await seedRankAchievements()
  })

  afterEach(async () => {
    await userOneCtx.redisExec.flushdb()
    await userOneCtx.redisAssessmentExec.flushdb()
    await testCleanup(prisma)
  })

  async function seedRankAchievements() {
    const achievements = [
      { id: 5, rewardedPoints: 30, rewardedXP: 15 },
      { id: 6, rewardedPoints: 20, rewardedXP: 10 },
      { id: 7, rewardedPoints: 10, rewardedXP: 5 },
    ]

    await Promise.all(
      achievements.map((achievement) =>
        prisma.achievement.upsert({
          where: { id: achievement.id },
          create: {
            ...achievement,
            name: `Rank ${achievement.id}`,
            icon: 'star',
            type: AchievementType.PARTICIPANT,
            scope: AchievementScope.GLOBAL,
          },
          update: {
            rewardedPoints: achievement.rewardedPoints,
            rewardedXP: achievement.rewardedXP,
          },
        })
      )
    )
  }

  async function seedGamifiedRunningQuiz() {
    const course = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: false },
      userOneCtx
    )
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC1.id)
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [{ id: SC.id, type: ElementType.SC }],
        status: PublicationStatus.PUBLISHED,
        courseId: course.id,
      },
      userOneCtx
    )
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlock: { liveQuizId: liveQuiz.id } },
    })
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: { elementData: processElementData(SC) },
    })

    const rewardInputs = [
      { score: 100, xp: 40 },
      { score: 80, xp: 30 },
      { score: 60, xp: 20 },
    ]
    const participants = await Promise.all(
      rewardInputs.map(async (reward) => {
        const participant = await prisma.participant.create({
          data: {
            username: uuidv4(),
            password: 'synthetic-test-password',
          },
        })
        const participation = await prisma.participation.create({
          data: {
            courseId: course.id,
            participantId: participant.id,
            isActive: true,
          },
        })
        await userOneCtx.redisExec.hset(
          `lq:${liveQuiz.id}:lb`,
          participant.id,
          reward.score
        )
        await userOneCtx.redisExec.hset(
          `lq:${liveQuiz.id}:xp`,
          participant.id,
          reward.xp
        )

        return { participant, participation, ...reward }
      })
    )

    return { course, liveQuiz, participants }
  }

  async function seedCompleteLegacyRankRun() {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: fixture.instanceId },
      include: { element: true },
    })
    const element = await prisma.element.update({
      where: { id: instance.elementId },
      data: {
        options: {
          ...(instance.element.options as object),
          hasSampleSolution: true,
        },
      },
    })
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: { elementData: processElementData(element) },
    })

    const rewards = [
      {
        participantId: fixture.participantId,
        participationId: fixture.participationId!,
        baseScore: 70,
        baseXp: 25,
        awardedScore: 100,
        awardedXp: 40,
        achievementId: 5,
      },
      {
        baseScore: 60,
        baseXp: 20,
        awardedScore: 80,
        awardedXp: 30,
        achievementId: 6,
      },
      {
        baseScore: 50,
        baseXp: 15,
        awardedScore: 60,
        awardedXp: 20,
        achievementId: 7,
      },
    ] as const

    await prisma.participant.update({
      where: { id: fixture.participantId },
      data: { xp: rewards[0].awardedXp },
    })
    await prisma.leaderboardEntry.update({
      where: {
        type_participantId_courseId: {
          type: 'COURSE',
          participantId: fixture.participantId,
          courseId: fixture.courseId!,
        },
      },
      data: { score: rewards[0].awardedScore },
    })
    await prisma.timelineEntry.update({
      where: {
        participationId_courseId_timestamp_type: {
          participationId: fixture.participationId!,
          courseId: fixture.courseId!,
          timestamp: fixture.timelineDate,
          type: TimelineEntryType.DAILY,
        },
      },
      data: {
        collectedPoints: rewards[0].awardedScore,
        collectedXp: rewards[0].awardedXp,
      },
    })
    await prisma.participantAchievementInstance.create({
      data: {
        participantId: fixture.participantId,
        achievementId: rewards[0].achievementId,
        achievedAt: fixture.timelineDate,
      },
    })

    for (const reward of rewards.slice(1)) {
      const participant = await prisma.participant.create({
        data: {
          username: uuidv4(),
          password: 'synthetic-test-password',
          xp: reward.awardedXp,
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId: fixture.courseId!,
          participantId: participant.id,
          isActive: true,
        },
      })
      await prisma.leaderboardEntry.createMany({
        data: [
          {
            type: 'SESSION',
            score: reward.baseScore,
            participantId: participant.id,
            liveQuizId: fixture.liveQuizId,
            sessionParticipationId: participation.id,
          },
          {
            type: 'COURSE',
            score: reward.awardedScore,
            participantId: participant.id,
            courseId: fixture.courseId,
          },
        ],
      })
      await prisma.participation.update({
        where: { id: participation.id },
        data: {
          courseLeaderboard: {
            connect: {
              type_participantId_courseId: {
                type: 'COURSE',
                participantId: participant.id,
                courseId: fixture.courseId!,
              },
            },
          },
        },
      })
      await prisma.timelineEntry.create({
        data: {
          type: TimelineEntryType.DAILY,
          timestamp: fixture.timelineDate,
          collectedPoints: reward.awardedScore,
          collectedXp: reward.awardedXp,
          participationId: participation.id,
          courseId: fixture.courseId!,
        },
      })
      await prisma.participantAchievementInstance.create({
        data: {
          participantId: participant.id,
          achievementId: reward.achievementId,
          achievedAt: fixture.timelineDate,
        },
      })
      await userOneCtx.redisExec.hset(
        `lq:${fixture.liveQuizId}:lb`,
        participant.id,
        reward.baseScore
      )
      await userOneCtx.redisExec.hset(
        `lq:${fixture.liveQuizId}:xp`,
        participant.id,
        reward.baseXp
      )
    }

    return fixture
  }

  function createSnapshotRedis(snapshotResult: unknown) {
    const queuedKeys: string[] = []
    const redisMulti = {
      hgetall(key: string) {
        queuedKeys.push(key)
        return redisMulti
      },
      exec: vi.fn(async () => snapshotResult),
    }
    const directHgetall = vi.fn(async () => ({}))
    const multi = vi.fn(() => redisMulti)

    return {
      redis: { hgetall: directHgetall, multi } as unknown as Redis,
      directHgetall,
      multi,
      redisMulti,
      queuedKeys,
    }
  }

  async function expectRegularQuizRewardsUntouched({
    liveQuizId,
    participantIds,
  }: {
    liveQuizId: string
    participantIds: string[]
  }) {
    expect(
      await prisma.liveQuiz.findUniqueOrThrow({
        where: { id: liveQuizId },
        select: {
          status: true,
          finishedAt: true,
          activeRewardRunId: true,
        },
      })
    ).toEqual({
      status: PublicationStatus.PUBLISHED,
      finishedAt: null,
      activeRewardRunId: null,
    })
    expect(
      await prisma.liveQuizRewardRun.count({
        where: { liveQuizId },
      })
    ).toBe(0)
    expect(
      await prisma.participant.findMany({
        where: { id: { in: participantIds } },
        orderBy: { id: 'asc' },
        select: { xp: true },
      })
    ).toEqual(participantIds.map(() => ({ xp: 0 })))
    expect(
      await prisma.leaderboardEntry.count({
        where: { participantId: { in: participantIds } },
      })
    ).toBe(0)
    expect(
      await prisma.timelineEntry.count({
        where: { participation: { participantId: { in: participantIds } } },
      })
    ).toBe(0)
    expect(
      await prisma.participantAchievementInstance.count({
        where: { participantId: { in: participantIds } },
      })
    ).toBe(0)
  }

  it('applies exact rewards and persists one active run atomically', async () => {
    const { course, liveQuiz, participants } = await seedGamifiedRunningQuiz()

    const endedQuiz = await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)
    const persistedQuiz = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
      include: {
        activeRewardRun: {
          include: { entries: { orderBy: { participantId: 'asc' } } },
        },
      },
    })

    expect(endedQuiz?.status).toBe(PublicationStatus.ENDED)
    expect(persistedQuiz.activeRewardRun).toMatchObject({
      status: LiveQuizRewardRunStatus.APPLIED,
      isLegacyReconstructed: false,
    })
    expect(persistedQuiz.activeRewardRun?.endedAt).toEqual(
      persistedQuiz.finishedAt
    )
    expect(persistedQuiz.activeRewardRun?.entries).toHaveLength(3)
    expect(persistedQuiz.activeRewardRun?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participantId: participants[0]!.participant.id,
          participationId: participants[0]!.participation.id,
          courseId: course.id,
          coursePointsAwarded: 130,
          participantXpAwarded: 55,
          timelinePointsAwarded: 130,
          timelineXpAwarded: 55,
          achievementId: 5,
          achievementCountAwarded: 1,
        }),
        expect.objectContaining({
          participantId: participants[1]!.participant.id,
          participationId: participants[1]!.participation.id,
          courseId: course.id,
          coursePointsAwarded: 100,
          participantXpAwarded: 40,
          timelinePointsAwarded: 100,
          timelineXpAwarded: 40,
          achievementId: 6,
          achievementCountAwarded: 1,
        }),
        expect.objectContaining({
          participantId: participants[2]!.participant.id,
          participationId: participants[2]!.participation.id,
          courseId: course.id,
          coursePointsAwarded: 70,
          participantXpAwarded: 25,
          timelinePointsAwarded: 70,
          timelineXpAwarded: 25,
          achievementId: 7,
          achievementCountAwarded: 1,
        }),
      ])
    )
    expect(
      persistedQuiz.activeRewardRun?.entries.every(
        (entry) => entry.participantId !== null
      )
    ).toBe(true)

    const rewardedParticipant = await prisma.participant.findUniqueOrThrow({
      where: { id: participants[0]!.participant.id },
    })
    expect(rewardedParticipant.xp).toBe(55)

    const courseLeaderboard = await prisma.leaderboardEntry.findUniqueOrThrow({
      where: {
        type_participantId_courseId: {
          type: 'COURSE',
          participantId: participants[0]!.participant.id,
          courseId: course.id,
        },
      },
    })
    expect(courseLeaderboard.score).toBe(130)

    const timeline = await prisma.timelineEntry.findFirstOrThrow({
      where: {
        participationId: participants[0]!.participation.id,
        courseId: course.id,
        type: TimelineEntryType.DAILY,
      },
    })
    expect(timeline).toMatchObject({
      collectedPoints: 130,
      collectedXp: 55,
    })

    const achievement =
      await prisma.participantAchievementInstance.findUniqueOrThrow({
        where: {
          participantId_achievementId: {
            participantId: participants[0]!.participant.id,
            achievementId: 5,
          },
        },
      })
    expect(achievement.achievedCount).toBe(1)

    await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)

    expect(
      await prisma.liveQuizRewardRun.count({
        where: {
          liveQuizId: liveQuiz.id,
          status: LiveQuizRewardRunStatus.APPLIED,
        },
      })
    ).toBe(1)
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participants[0]!.participant.id },
        })
      ).xp
    ).toBe(55)
  })

  it('reads leaderboard and XP through one Redis transaction', async () => {
    const { liveQuiz, participants } = await seedGamifiedRunningQuiz()
    const quizLeaderboard = await userOneCtx.redisExec.hgetall(
      `lq:${liveQuiz.id}:lb`
    )
    const quizXp = await userOneCtx.redisExec.hgetall(`lq:${liveQuiz.id}:xp`)
    const snapshotRedis = createSnapshotRedis([
      [null, quizLeaderboard],
      [null, quizXp],
    ])
    const snapshotCtx = {
      ...userOneCtx,
      redisExec: snapshotRedis.redis,
    }

    const endedQuiz = await endLiveQuiz({ id: liveQuiz.id }, snapshotCtx)

    expect(endedQuiz?.status).toBe(PublicationStatus.ENDED)
    expect(snapshotRedis.multi).toHaveBeenCalledTimes(1)
    expect(snapshotRedis.queuedKeys).toEqual([
      `lq:${liveQuiz.id}:lb`,
      `lq:${liveQuiz.id}:xp`,
    ])
    expect(snapshotRedis.redisMulti.exec).toHaveBeenCalledTimes(1)
    expect(snapshotRedis.directHgetall).not.toHaveBeenCalled()
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participants[0]!.participant.id },
        })
      ).xp
    ).toBe(55)
  })

  it.each([
    [
      'a command-level Redis error',
      [
        [new Error('synthetic Redis command failure'), null],
        [null, {}],
      ],
    ],
    [
      'a malformed Redis result',
      [
        [null, []],
        [null, {}],
      ],
    ],
  ])('rejects %s without ending or applying rewards', async (_, result) => {
    const { liveQuiz, participants } = await seedGamifiedRunningQuiz()
    const snapshotRedis = createSnapshotRedis(result)
    const snapshotCtx = {
      ...userOneCtx,
      redisExec: snapshotRedis.redis,
    }

    await expect(
      endLiveQuiz({ id: liveQuiz.id }, snapshotCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'LIVE_QUIZ_REWARD_DATA_INVALID' },
    })
    await expectRegularQuizRewardsUntouched({
      liveQuizId: liveQuiz.id,
      participantIds: participants.map(
        (participant) => participant.participant.id
      ),
    })
  })

  it.each([
    ['partial leaderboard data', 'lb', '100points'],
    ['decimal XP data', 'xp', '40.5'],
    ['non-canonical leaderboard data', 'lb', '0100'],
    ['negative leaderboard data', 'lb', '-1'],
    ['negative XP data', 'xp', '-1'],
    ['XP above the Int32 range', 'xp', '2147483648'],
    ['leaderboard data below the Int32 range', 'lb', '-2147483649'],
  ])(
    'rejects %s without ending or applying rewards',
    async (_, rewardType, value) => {
      const { liveQuiz, participants } = await seedGamifiedRunningQuiz()
      await userOneCtx.redisExec.hset(
        `lq:${liveQuiz.id}:${rewardType}`,
        participants[0]!.participant.id,
        value
      )

      await expect(
        endLiveQuiz({ id: liveQuiz.id }, userOneCtx)
      ).rejects.toMatchObject({
        extensions: { code: 'LIVE_QUIZ_REWARD_DATA_INVALID' },
      })
      await expectRegularQuizRewardsUntouched({
        liveQuizId: liveQuiz.id,
        participantIds: participants.map(
          (participant) => participant.participant.id
        ),
      })
    }
  )

  it('ends without rank definitions when rank achievements cannot apply', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: false },
      userOneCtx
    )
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [],
        status: PublicationStatus.PUBLISHED,
        courseId: course.id,
      },
      userOneCtx
    )
    const participant = await prisma.participant.create({
      data: {
        username: uuidv4(),
        password: 'synthetic-test-password',
      },
    })
    const participation = await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    await userOneCtx.redisExec.hset(`lq:${liveQuiz.id}:lb`, participant.id, 100)
    await userOneCtx.redisExec.hset(`lq:${liveQuiz.id}:xp`, participant.id, 40)
    await prisma.achievement.deleteMany({
      where: { id: { in: [5, 6, 7] } },
    })

    await expect(
      endLiveQuiz({ id: liveQuiz.id }, userOneCtx)
    ).resolves.toMatchObject({ status: PublicationStatus.ENDED })
    await expect(
      prisma.liveQuizRewardEntry.findFirstOrThrow({
        where: { rewardRun: { liveQuizId: liveQuiz.id } },
      })
    ).resolves.toMatchObject({
      participantId: participant.id,
      participationId: participation.id,
      coursePointsAwarded: 100,
      participantXpAwarded: 40,
      achievementId: null,
    })
  })

  it('persists an empty applied run for a non-gamified regular quiz', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: false },
      userOneCtx
    )
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [],
        status: PublicationStatus.PUBLISHED,
        courseId: course.id,
      },
      userOneCtx
    )
    const participant = await prisma.participant.create({
      data: {
        username: uuidv4(),
        password: 'synthetic-test-password',
        xp: 10,
      },
    })
    await userOneCtx.redisExec.hset(`lq:${liveQuiz.id}:lb`, participant.id, 100)
    await userOneCtx.redisExec.hset(`lq:${liveQuiz.id}:xp`, participant.id, 40)

    await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)

    const persistedQuiz = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
      include: { activeRewardRun: { include: { entries: true } } },
    })
    expect(persistedQuiz.activeRewardRun).toMatchObject({
      status: LiveQuizRewardRunStatus.APPLIED,
      isLegacyReconstructed: false,
      entries: [],
    })
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participant.id },
        })
      ).xp
    ).toBe(10)
  })

  it('awards XP and timeline XP but no course points when the linked course is not gamified', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: false },
      userOneCtx
    )
    const seededLiveQuiz = await seedLiveQuiz(
      {
        elements: [],
        status: PublicationStatus.PUBLISHED,
        courseId: course.id,
      },
      userOneCtx
    )
    const liveQuiz = await prisma.liveQuiz.update({
      where: { id: seededLiveQuiz.id },
      data: { isGamificationEnabled: true },
    })
    const participant = await prisma.participant.create({
      data: {
        username: uuidv4(),
        password: 'synthetic-test-password',
      },
    })
    const participation = await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    await userOneCtx.redisExec.hset(`lq:${liveQuiz.id}:lb`, participant.id, 100)
    await userOneCtx.redisExec.hset(`lq:${liveQuiz.id}:xp`, participant.id, 40)

    await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)

    const persistedQuiz = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
      include: { activeRewardRun: { include: { entries: true } } },
    })
    expect(persistedQuiz.activeRewardRun?.entries).toEqual([
      expect.objectContaining({
        participantId: participant.id,
        participationId: participation.id,
        courseId: course.id,
        coursePointsAwarded: 0,
        participantXpAwarded: 40,
        timelinePointsAwarded: 0,
        timelineXpAwarded: 40,
        achievementId: null,
        achievementCountAwarded: 0,
      }),
    ])
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participant.id },
        })
      ).xp
    ).toBe(40)
    expect(
      await prisma.leaderboardEntry.count({
        where: {
          type: 'COURSE',
          participantId: participant.id,
          courseId: course.id,
        },
      })
    ).toBe(0)
    expect(
      await prisma.timelineEntry.findUniqueOrThrow({
        where: {
          participationId_courseId_timestamp_type: {
            participationId: participation.id,
            courseId: course.id,
            timestamp: persistedQuiz.finishedAt!,
            type: TimelineEntryType.DAILY,
          },
        },
      })
    ).toMatchObject({ collectedPoints: 0, collectedXp: 40 })
  })

  it('does not duplicate rewards or runs when ending concurrently', async () => {
    const { liveQuiz, participants } = await seedGamifiedRunningQuiz()

    const results = await Promise.all([
      endLiveQuiz({ id: liveQuiz.id }, userOneCtx),
      endLiveQuiz({ id: liveQuiz.id }, userOneCtx),
    ])

    expect(results.map((result) => result?.status)).toEqual([
      PublicationStatus.ENDED,
      PublicationStatus.ENDED,
    ])
    expect(
      await prisma.liveQuizRewardRun.count({
        where: {
          liveQuizId: liveQuiz.id,
          status: LiveQuizRewardRunStatus.APPLIED,
        },
      })
    ).toBe(1)
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participants[0]!.participant.id },
        })
      ).xp
    ).toBe(55)
  })

  it('persists legacy deltas without applying them again', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: false },
      userOneCtx
    )
    const participant = await prisma.participant.create({
      data: {
        username: uuidv4(),
        password: 'synthetic-test-password',
        xp: 75,
      },
    })
    const participation = await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [],
        status: PublicationStatus.ENDED,
        courseId: course.id,
      },
      userOneCtx
    )
    const endedAt = new Date('2026-07-30T10:00:00.000Z')
    await prisma.leaderboardEntry.create({
      data: {
        type: 'COURSE',
        participantId: participant.id,
        courseId: course.id,
        participation: { connect: { id: participation.id } },
        score: 200,
      },
    })
    await prisma.timelineEntry.create({
      data: {
        type: TimelineEntryType.DAILY,
        timestamp: endedAt,
        collectedPoints: 150,
        collectedXp: 75,
        courseId: course.id,
        participationId: participation.id,
      },
    })
    await prisma.participantAchievementInstance.create({
      data: {
        participantId: participant.id,
        achievementId: 5,
        achievedAt: endedAt,
        achievedCount: 3,
      },
    })

    const rewardRunId = await prisma.$transaction((tx) =>
      persistLiveQuizRewardRun({
        liveQuizId: liveQuiz.id,
        plan: {
          endedAt,
          isLegacyReconstructed: true,
          entries: [
            {
              participantId: participant.id,
              participationId: participation.id,
              courseId: course.id,
              coursePointsAwarded: 30,
              participantXpAwarded: 25,
              timelineDate: endedAt,
              timelinePointsAwarded: 30,
              timelineXpAwarded: 25,
              achievementId: 5,
              achievementCountAwarded: 1,
            },
          ],
        },
        tx,
      })
    )

    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participant.id },
        })
      ).xp
    ).toBe(75)
    expect(
      await prisma.leaderboardEntry.findUniqueOrThrow({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: participant.id,
            courseId: course.id,
          },
        },
      })
    ).toMatchObject({ score: 200 })
    expect(
      await prisma.timelineEntry.findUniqueOrThrow({
        where: {
          participationId_courseId_timestamp_type: {
            participationId: participation.id,
            courseId: course.id,
            timestamp: endedAt,
            type: TimelineEntryType.DAILY,
          },
        },
      })
    ).toMatchObject({ collectedPoints: 150, collectedXp: 75 })
    expect(
      await prisma.participantAchievementInstance.findUniqueOrThrow({
        where: {
          participantId_achievementId: {
            participantId: participant.id,
            achievementId: 5,
          },
        },
      })
    ).toMatchObject({ achievedCount: 3 })
    expect(
      await prisma.liveQuizRewardRun.findUniqueOrThrow({
        where: { id: rewardRunId },
        include: { entries: true },
      })
    ).toMatchObject({
      isLegacyReconstructed: true,
      status: LiveQuizRewardRunStatus.APPLIED,
      entries: [
        expect.objectContaining({
          participantId: participant.id,
          coursePointsAwarded: 30,
          participantXpAwarded: 25,
          timelinePointsAwarded: 30,
          timelineXpAwarded: 25,
          achievementId: 5,
          achievementCountAwarded: 1,
        }),
      ],
    })
  })

  it('reconstructs a complete legacy gamified run from canonical reward evidence', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )

    const inspection = await inspectLegacyRegularLiveQuizRewards(
      { liveQuizId: fixture.liveQuizId },
      userOneCtx
    )

    expect(inspection.status).toBe('AVAILABLE')
    expect(inspection.plan).toMatchObject({
      isLegacyReconstructed: true,
      endedAt: fixture.timelineDate,
      entries: [
        expect.objectContaining({
          participantId: fixture.participantId,
          participationId: fixture.participationId,
          courseId: fixture.courseId,
          coursePointsAwarded: fixture.awardedCoursePoints,
          participantXpAwarded: fixture.awardedParticipantXp,
          timelinePointsAwarded: fixture.awardedTimelinePoints,
          timelineXpAwarded: fixture.awardedTimelineXp,
        }),
      ],
    })
    expect(
      await prisma.liveQuizRewardRun.count({
        where: { liveQuizId: fixture.liveQuizId },
      })
    ).toBe(0)
    expect(
      (
        await prisma.liveQuiz.findUniqueOrThrow({
          where: { id: fixture.liveQuizId },
          select: { activeRewardRunId: true },
        })
      ).activeRewardRunId
    ).toBeNull()
  })

  it('rejects legacy rewards when the XP hash has expired', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await userOneCtx.redisExec.del(`lq:${fixture.liveQuizId}:xp`)

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rejects mismatched leaderboard and XP participant sets', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await userOneCtx.redisExec.hdel(
      `lq:${fixture.liveQuizId}:xp`,
      fixture.participantId
    )

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it.each([
    ['non-canonical XP', 'xp', '025'],
    ['decimal leaderboard', 'lb', '70.5'],
    ['out-of-range XP', 'xp', '2147483648'],
  ])('rejects %s legacy cache data', async (_, rewardType, value) => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await userOneCtx.redisExec.hset(
      `lq:${fixture.liveQuizId}:${rewardType}`,
      fixture.participantId,
      value
    )

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rejects Redis leaderboard scores that disagree with persisted scores', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await userOneCtx.redisExec.hset(
      `lq:${fixture.liveQuizId}:lb`,
      fixture.participantId,
      fixture.awardedCoursePoints + 1
    )

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rejects malformed participant identifiers in legacy cache data', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await userOneCtx.redisExec.hset(
      `lq:${fixture.liveQuizId}:xp`,
      'not-a-participant-uuid',
      10
    )

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rejects duplicate permanent participant leaderboard evidence', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.temporaryLeaderboardEntry.create({
      data: {
        id: fixture.participantId,
        quizId: fixture.liveQuizId,
        username: 'Synthetic duplicate',
        score: fixture.awardedCoursePoints,
      },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('keeps complete inactive responder evidence in legacy rank reconstruction', async () => {
    const fixture = await seedCompleteLegacyRankRun()
    await prisma.participation.update({
      where: { id: fixture.participationId! },
      data: { isActive: false },
    })
    await prisma.leaderboardEntry.deleteMany({
      where: {
        participantId: fixture.participantId,
        liveQuizId: fixture.liveQuizId,
        type: 'SESSION',
      },
    })
    await prisma.leaderboardEntry.deleteMany({
      where: {
        participantId: fixture.participantId,
        courseId: fixture.courseId!,
        type: 'COURSE',
      },
    })
    await prisma.timelineEntry.update({
      where: {
        participationId_courseId_timestamp_type: {
          participationId: fixture.participationId!,
          courseId: fixture.courseId!,
          timestamp: fixture.timelineDate,
          type: TimelineEntryType.DAILY,
        },
      },
      data: { collectedPoints: 0 },
    })

    const inspection = await inspectLegacyRegularLiveQuizRewards(
      { liveQuizId: fixture.liveQuizId },
      userOneCtx
    )

    expect(inspection).toMatchObject({
      status: 'AVAILABLE',
      plan: {
        entries: expect.arrayContaining([
          expect.objectContaining({
            participantId: fixture.participantId,
            coursePointsAwarded: 0,
            participantXpAwarded: 40,
            timelinePointsAwarded: 0,
            timelineXpAwarded: 40,
            achievementId: 5,
          }),
        ]),
      },
    })
  })

  it('accepts a permanent temporary leaderboard entry for a non-gamified course', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.course.update({
      where: { id: fixture.courseId! },
      data: { isGamificationEnabled: false },
    })
    await prisma.leaderboardEntry.deleteMany({
      where: {
        participantId: fixture.participantId,
        liveQuizId: fixture.liveQuizId,
        type: 'SESSION',
      },
    })
    await prisma.leaderboardEntry.deleteMany({
      where: {
        participantId: fixture.participantId,
        courseId: fixture.courseId!,
        type: 'COURSE',
      },
    })
    await prisma.temporaryLeaderboardEntry.create({
      data: {
        id: fixture.participantId,
        quizId: fixture.liveQuizId,
        username: 'Synthetic permanent participant',
        score: fixture.awardedCoursePoints,
      },
    })
    await prisma.timelineEntry.update({
      where: {
        participationId_courseId_timestamp_type: {
          participationId: fixture.participationId!,
          courseId: fixture.courseId!,
          timestamp: fixture.timelineDate,
          type: TimelineEntryType.DAILY,
        },
      },
      data: { collectedPoints: 0 },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({
      status: 'AVAILABLE',
      plan: {
        entries: [
          expect.objectContaining({
            participantId: fixture.participantId,
            coursePointsAwarded: 0,
            participantXpAwarded: fixture.awardedParticipantXp,
          }),
        ],
      },
    })
  })

  it('rejects a permanent inactive responder whose leaderboard cache evidence is missing without writing state', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    const inactiveParticipant = await prisma.participant.create({
      data: {
        username: uuidv4(),
        password: 'synthetic-test-password',
        xp: 12,
      },
    })
    const inactiveParticipation = await prisma.participation.create({
      data: {
        courseId: fixture.courseId!,
        participantId: inactiveParticipant.id,
        isActive: false,
      },
    })
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: fixture.timelineDate,
        response: { choices: [{ ix: 0, selected: true }] },
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        timeSpent: 1,
        elementBlockExecution: 0,
        instanceId: fixture.instanceId,
        participantId: inactiveParticipant.id,
      },
    })
    await prisma.timelineEntry.create({
      data: {
        type: TimelineEntryType.DAILY,
        timestamp: fixture.timelineDate,
        collectedPoints: 0,
        collectedXp: 12,
        courseId: fixture.courseId!,
        participationId: inactiveParticipation.id,
      },
    })
    await userOneCtx.redisExec.hset(
      `lq:${fixture.liveQuizId}:lb`,
      inactiveParticipant.id,
      0
    )
    await userOneCtx.redisExec.hset(
      `lq:${fixture.liveQuizId}:xp`,
      inactiveParticipant.id,
      12
    )
    await userOneCtx.redisExec.hdel(
      `lq:${fixture.liveQuizId}:lb`,
      inactiveParticipant.id
    )

    const readRewardState = async () => ({
      activeRewardRunId: (
        await prisma.liveQuiz.findUniqueOrThrow({
          where: { id: fixture.liveQuizId },
          select: { activeRewardRunId: true },
        })
      ).activeRewardRunId,
      rewardRunCount: await prisma.liveQuizRewardRun.count({
        where: { liveQuizId: fixture.liveQuizId },
      }),
      participantXp: (
        await prisma.participant.findUniqueOrThrow({
          where: { id: inactiveParticipant.id },
          select: { xp: true },
        })
      ).xp,
      responseCount: await prisma.liveQuizResponse.count({
        where: { participantId: inactiveParticipant.id },
      }),
      timelineCount: await prisma.timelineEntry.count({
        where: { participationId: inactiveParticipation.id },
      }),
    })
    const stateBeforeInspection = await readRewardState()

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
    await expect(readRewardState()).resolves.toEqual(stateBeforeInspection)
  })

  it('ignores genuine temporary participants during legacy reconstruction', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    const temporaryParticipantId = uuidv4()
    await prisma.temporaryLeaderboardEntry.create({
      data: {
        id: temporaryParticipantId,
        quizId: fixture.liveQuizId,
        username: 'Synthetic temporary participant',
        score: 35,
      },
    })
    await userOneCtx.redisExec.hset(
      `lq:${fixture.liveQuizId}:lb`,
      temporaryParticipantId,
      35
    )
    await userOneCtx.redisExec.hset(
      `lq:${fixture.liveQuizId}:xp`,
      temporaryParticipantId,
      9
    )

    const inspection = await inspectLegacyRegularLiveQuizRewards(
      { liveQuizId: fixture.liveQuizId },
      userOneCtx
    )

    expect(inspection).toMatchObject({
      status: 'AVAILABLE',
      plan: {
        entries: [
          expect.objectContaining({ participantId: fixture.participantId }),
        ],
      },
    })
    expect(inspection.plan?.entries).toHaveLength(1)
  })

  it('accepts missing daily and compacted weekly timeline state', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.timelineEntry.deleteMany({
      where: {
        participationId: fixture.participationId!,
        courseId: fixture.courseId!,
      },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({ status: 'AVAILABLE' })
  })

  it('rejects an insufficient surviving timeline entry', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.timelineEntry.update({
      where: {
        participationId_courseId_timestamp_type: {
          participationId: fixture.participationId!,
          courseId: fixture.courseId!,
          timestamp: fixture.timelineDate,
          type: TimelineEntryType.DAILY,
        },
      },
      data: {
        collectedPoints: fixture.awardedTimelinePoints - 1,
        collectedXp: fixture.awardedTimelineXp - 1,
      },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rejects missing participant and course reward state', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.participant.update({
      where: { id: fixture.participantId },
      data: { xp: fixture.awardedParticipantXp - 1 },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })

    await prisma.participant.update({
      where: { id: fixture.participantId },
      data: { xp: fixture.awardedParticipantXp },
    })
    await prisma.leaderboardEntry.delete({
      where: {
        type_participantId_courseId: {
          type: 'COURSE',
          participantId: fixture.participantId,
          courseId: fixture.courseId!,
        },
      },
    })
    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('accepts exact compacted weekly timeline evidence', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.timelineEntry.deleteMany({
      where: {
        participationId: fixture.participationId!,
        courseId: fixture.courseId!,
      },
    })
    await prisma.timelineEntry.create({
      data: {
        type: TimelineEntryType.WEEKLY,
        timestamp: new Date('2026-07-27T00:00:00.000Z'),
        collectedPoints: fixture.awardedTimelinePoints,
        collectedXp: fixture.awardedTimelineXp,
        participationId: fixture.participationId!,
        courseId: fixture.courseId!,
      },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({ status: 'AVAILABLE' })
  })

  it('does not require rank definitions without a sample solution or three scores', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.achievement.deleteMany({
      where: { id: { in: [5, 6, 7] } },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({ status: 'AVAILABLE' })
  })

  it('does not require rank definitions for an empty legacy reward set', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
      { gamified: true, withRewardRun: false },
      userOneCtx
    )
    await prisma.participant.delete({
      where: { id: fixture.participantId },
    })
    await userOneCtx.redisExec.del(
      `lq:${fixture.liveQuizId}:lb`,
      `lq:${fixture.liveQuizId}:xp`
    )
    await prisma.achievement.deleteMany({
      where: { id: { in: [5, 6, 7] } },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({
      status: 'AVAILABLE',
      plan: { entries: [] },
    })
  })

  it('rejects missing rank definitions when rank achievements apply', async () => {
    const fixture = await seedCompleteLegacyRankRun()
    await prisma.achievement.delete({ where: { id: 5 } })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rejects missing rank achievement reward state', async () => {
    const fixture = await seedCompleteLegacyRankRun()

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toMatchObject({ status: 'AVAILABLE' })

    await prisma.participantAchievementInstance.delete({
      where: {
        participantId_achievementId: {
          participantId: fixture.participantId,
          achievementId: 5,
        },
      },
    })
    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rejects an invalid cross-quiz active reward pointer', async () => {
    const fixture = await seedEndedRegularLiveQuizForReset(
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
        endedAt: fixture.timelineDate,
      },
    })
    await prisma.liveQuiz.update({
      where: { id: fixture.liveQuizId },
      data: { activeRewardRunId: otherRun.id },
    })

    await expect(
      inspectLegacyRegularLiveQuizRewards(
        { liveQuizId: fixture.liveQuizId },
        userOneCtx
      )
    ).resolves.toEqual({ status: 'UNAVAILABLE', plan: null })
  })

  it('rolls back the end transition when an applied run already exists', async () => {
    const { liveQuiz, participants } = await seedGamifiedRunningQuiz()
    const existingRun = await prisma.liveQuizRewardRun.create({
      data: {
        liveQuizId: liveQuiz.id,
        endedAt: new Date(),
      },
    })

    await expect(
      endLiveQuiz({ id: liveQuiz.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'LIVE_QUIZ_END_CONFLICT' },
    })

    expect(
      await prisma.liveQuiz.findUniqueOrThrow({
        where: { id: liveQuiz.id },
        select: { status: true, activeRewardRunId: true },
      })
    ).toEqual({
      status: PublicationStatus.PUBLISHED,
      activeRewardRunId: null,
    })
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participants[0]!.participant.id },
        })
      ).xp
    ).toBe(0)
    expect(
      await prisma.liveQuizRewardRun.findMany({
        where: { liveQuizId: liveQuiz.id },
        select: { id: true },
      })
    ).toEqual([{ id: existingRun.id }])
  })

  it('does not treat an invalid active reward pointer as a completed end race', async () => {
    const { liveQuiz, participants } = await seedGamifiedRunningQuiz()
    const otherQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )
    const otherRun = await prisma.liveQuizRewardRun.create({
      data: {
        liveQuizId: otherQuiz.id,
        endedAt: new Date(),
      },
    })
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { activeRewardRunId: otherRun.id },
    })

    await expect(
      endLiveQuiz({ id: liveQuiz.id }, userOneCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'LIVE_QUIZ_END_CONFLICT' },
    })
    expect(
      await prisma.liveQuiz.findUniqueOrThrow({
        where: { id: liveQuiz.id },
        select: { status: true, activeRewardRunId: true },
      })
    ).toEqual({
      status: PublicationStatus.PUBLISHED,
      activeRewardRunId: otherRun.id,
    })
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participants[0]!.participant.id },
        })
      ).xp
    ).toBe(0)
  })

  it('preserves assessment ending without creating a reward run', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: true },
      userOneCtx
    )
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [],
        status: PublicationStatus.PUBLISHED,
        courseId: course.id,
      },
      userOneCtx
    )
    const participant = await prisma.participant.create({
      data: {
        username: uuidv4(),
        password: 'synthetic-test-password',
      },
    })
    await prisma.participation.create({
      data: {
        courseId: course.id,
        participantId: participant.id,
        isActive: true,
      },
    })
    await userOneCtx.redisAssessmentExec.hset(
      `lq:${liveQuiz.id}:lb`,
      participant.id,
      100
    )
    await userOneCtx.redisAssessmentExec.hset(
      `lq:${liveQuiz.id}:xp`,
      participant.id,
      40
    )

    const endedQuiz = await endLiveQuiz({ id: liveQuiz.id }, userOneCtx)

    expect(endedQuiz?.status).toBe(PublicationStatus.ENDED)
    expect(
      await prisma.liveQuiz.findUniqueOrThrow({
        where: { id: liveQuiz.id },
        select: { activeRewardRunId: true },
      })
    ).toEqual({ activeRewardRunId: null })
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participant.id },
        })
      ).xp
    ).toBe(40)
    expect(
      await prisma.leaderboardEntry.findUniqueOrThrow({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId: participant.id,
            courseId: course.id,
          },
        },
      })
    ).toMatchObject({ score: 100 })
  })

  it('rejects an active reward pointer to another quiz', async () => {
    const firstQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )
    const secondQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )
    const rewardRun = await prisma.liveQuizRewardRun.create({
      data: {
        liveQuizId: firstQuiz.id,
        endedAt: new Date(),
      },
    })
    await prisma.liveQuiz.update({
      where: { id: secondQuiz.id },
      data: { activeRewardRunId: rewardRun.id },
    })

    await expect(
      prisma.$transaction((tx) =>
        persistLiveQuizRewardRun({
          liveQuizId: secondQuiz.id,
          plan: {
            endedAt: new Date(),
            isLegacyReconstructed: false,
            entries: [],
          },
          tx,
        })
      )
    ).rejects.toMatchObject({
      extensions: { code: 'LIVE_QUIZ_REWARD_CONFLICT' },
    })
    expect(
      await prisma.liveQuizRewardRun.count({
        where: { liveQuizId: secondQuiz.id },
      })
    ).toBe(0)
  })
})
