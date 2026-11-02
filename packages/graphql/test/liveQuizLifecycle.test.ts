import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import type { Redis } from 'ioredis'
import schedule from 'node-schedule'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  activateLiveQuizBlock,
  deactivateLiveQuizBlock,
  endLiveQuiz,
  getControlLiveQuizFeedbacks,
} from '../src/services/liveQuizzes.js'

vi.mock('node-schedule', () => ({
  default: { scheduleJob: vi.fn() },
}))

vi.mock('../src/services/notifications.js', () => ({
  sendTeamsNotification: vi.fn(async () => undefined),
  handleSendPushNotifications: vi.fn(),
  handleSendTeamsNotification: vi.fn(),
}))

let prisma: DB.PrismaClient
const { graphql } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

const fixtureIds = {
  users: [] as string[],
  participants: [] as string[],
  quizzes: [] as string[],
}

function signal() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function bounded<T>(promise: Promise<T>, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out waiting for ${label}`)),
          5_000
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

type Fixture = {
  ownerId: string
  courseId: string
  quizId: string
  blockId: number
  participantId?: string
  participationId?: number
}

async function createFixture({
  withParticipant = false,
}: {
  withParticipant?: boolean
} = {}): Promise<Fixture> {
  await requireDisposableDatabase(prisma)

  const ownerId = randomUUID()
  const courseId = randomUUID()
  const quizId = randomUUID()
  const participantId = withParticipant ? randomUUID() : undefined
  fixtureIds.users.push(ownerId)
  fixtureIds.quizzes.push(quizId)
  if (participantId) fixtureIds.participants.push(participantId)

  await prisma.user.create({
    data: {
      id: ownerId,
      email: `${ownerId}@example.org`,
      shortname: `lifecycle-${ownerId.slice(0, 8)}`,
    },
  })

  await prisma.course.create({
    data: {
      id: courseId,
      ownerId,
      name: `Synthetic lifecycle course ${courseId}`,
      displayName: 'Synthetic lifecycle course',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.000Z'),
      groupDeadlineDate: new Date('2026-06-30T23:59:59.000Z'),
      authType: DB.CourseAuthType.SSO,
      isGamificationEnabled: true,
    },
  })

  let participationId: number | undefined
  if (participantId) {
    await prisma.participant.create({
      data: {
        id: participantId,
        username: `lifecycle-${participantId}`,
        password: '',
      },
    })
    const participation = await prisma.participation.create({
      data: {
        courseId,
        participantId,
        isActive: true,
      },
    })
    participationId = participation.id
  }

  const quiz = await prisma.liveQuiz.create({
    data: {
      id: quizId,
      ownerId,
      courseId,
      name: `Synthetic lifecycle quiz ${quizId}`,
      displayName: 'Synthetic lifecycle quiz',
      status: DB.PublicationStatus.PUBLISHED,
      activeBlockId: null,
      blocks: {
        create: {
          order: 0,
          timeLimit: null,
          status: DB.ElementBlockStatus.SCHEDULED,
        },
      },
    },
    include: { blocks: true },
  })

  const blockId = quiz.blocks[0]!.id

  return {
    ownerId,
    courseId,
    quizId,
    blockId,
    participantId,
    participationId,
  }
}

async function rewardSnapshot(fixture: Fixture) {
  const participantId = fixture.participantId!
  return {
    participant: await prisma.participant.findUniqueOrThrow({
      where: { id: participantId },
      select: { id: true, xp: true, updatedAt: true },
    }),
    participation: await prisma.participation.findUniqueOrThrow({
      where: {
        courseId_participantId: {
          courseId: fixture.courseId,
          participantId,
        },
      },
      select: {
        id: true,
        isActive: true,
        courseLeaderboardId: true,
        updatedAt: true,
      },
    }),
    leaderboardEntries: await prisma.leaderboardEntry.findMany({
      where: {
        courseId: fixture.courseId,
        participantId,
      },
      orderBy: { id: 'asc' },
    }),
    timelineEntries: await prisma.timelineEntry.findMany({
      where: { participationId: fixture.participationId },
      orderBy: { id: 'asc' },
    }),
  }
}

async function expectAwards(fixture: Fixture) {
  const rewards = await rewardSnapshot(fixture)
  expect(rewards.participant.xp).toBe(7)
  expect(rewards.leaderboardEntries).toEqual([
    expect.objectContaining({
      participantId: fixture.participantId,
      courseId: fixture.courseId,
      type: DB.LeaderboardType.COURSE,
      score: 11,
    }),
  ])
  expect(rewards.timelineEntries).toEqual([
    expect.objectContaining({
      participationId: fixture.participationId,
      courseId: fixture.courseId,
      type: DB.TimelineEntryType.DAILY,
      collectedXp: 7,
      collectedPoints: 11,
    }),
  ])
}

type RedisStubOptions = {
  quizId: string
  lb?: Record<string, string>
  xp?: Record<string, string>
  holdFirstRead?: boolean
  hashes?: Record<string, Record<string, string>>
  holdFirstCacheRead?: boolean
}

function createRedisStub({
  quizId,
  lb = {},
  xp = {},
  holdFirstRead = false,
  hashes = {},
  holdFirstCacheRead = false,
}: RedisStubOptions) {
  const hold =
    holdFirstRead || holdFirstCacheRead
      ? { entered: signal(), release: signal() }
      : undefined
  let isHeld = false

  const pipelineCommands = {
    hmset: vi.fn(),
    hset: vi.fn(),
    exec: vi.fn(async () => []),
  }
  const pipeline = vi.fn(() => pipelineCommands)
  const multi = vi.fn(() => {
    const keys: string[] = []
    const commands = {
      hgetall(key: string) {
        keys.push(key)
        return commands
      },
      async exec() {
        const values = keys.map((key) => [null, hashes[key] ?? {}])
        if (holdFirstCacheRead && hold && !isHeld) {
          isHeld = true
          hold.entered.resolve()
          await hold.release.promise
        }
        return values
      },
    }
    return commands
  })
  const hgetall = vi.fn(async (key: string) => {
    if (hold && !isHeld) {
      isHeld = true
      hold.entered.resolve()
      await hold.release.promise
    }
    if (key === `lq:${quizId}:lb`) return lb
    if (key === `lq:${quizId}:xp`) return xp
    return {}
  })

  return {
    redis: { hgetall, pipeline, multi } as unknown as Redis,
    hgetall,
    pipeline,
    pipelineCommands,
    multi,
    hold,
  }
}

function createContext({
  ownerId,
  client,
  redis,
}: {
  ownerId: string
  client: DB.PrismaClient
  redis: Redis
}) {
  const pubSubPublish = vi.fn(async () => undefined)
  const emitterEmit = vi.fn()
  const taskSchedule = {
    standard: vi.fn(async () => undefined),
    assessment: vi.fn(async () => undefined),
  }

  const context = {
    prisma: client,
    redisExec: redis,
    redisAssessmentExec: redis,
    pubSub: { publish: pubSubPublish },
    emitter: { emit: emitterEmit },
    tasks: {
      aggregateLiveQuizBlockResultsStandard: {
        schedule: taskSchedule.standard,
      },
      aggregateLiveQuizBlockResultsAssessment: {
        schedule: taskSchedule.assessment,
      },
    },
    user: {
      sub: ownerId,
      role: DB.UserRole.USER,
      scope: DB.UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser

  return { context, pubSubPublish, emitterEmit, taskSchedule }
}

async function addCloseQuestion(fixture: Fixture, blockId = fixture.blockId) {
  const element = await prisma.element.create({
    data: {
      ownerId: fixture.ownerId,
      name: 'Synthetic close question',
      content: 'Synthetic close question',
      type: DB.ElementType.SC,
      options: {
        choices: [],
        displayMode: DisplayMode.LIST,
        hasSampleSolution: false,
      },
    },
  })
  return prisma.elementInstance.create({
    data: {
      ownerId: fixture.ownerId,
      elementId: element.id,
      elementBlockId: blockId,
      type: DB.ElementInstanceType.LIVE_QUIZ,
      elementType: DB.ElementType.SC,
      order: 0,
      options: {},
      elementData: {
        ...element,
        id: String(element.id),
        elementId: element.id,
        type: 'SC',
        options: {
          choices: [],
          displayMode: DisplayMode.LIST,
          hasSampleSolution: false,
        },
      },
      results: { choices: {}, total: 0 },
      anonymousResults: { choices: {}, total: 0 },
    },
  })
}

type InstrumentOptions = {
  onLiveQuizUpdateMany?: (call: number) => void
  onLiveQuizUpdate?: () => void
  failTimelineUpsert?: Error
}

function instrumentPrisma({
  onLiveQuizUpdateMany,
  onLiveQuizUpdate,
  failTimelineUpsert,
}: InstrumentOptions = {}) {
  let updateManyCalls = 0

  const client = prisma.$extends({
    query: {
      liveQuiz: {
        async updateMany({ args, query }) {
          updateManyCalls += 1
          onLiveQuizUpdateMany?.(updateManyCalls)
          return query(args)
        },
        async update({ args, query }) {
          onLiveQuizUpdate?.()
          return query(args)
        },
      },
      timelineEntry: {
        async upsert({ args, query }) {
          if (failTimelineUpsert) throw failTimelineUpsert
          return query(args)
        },
      },
    },
  })

  return client as unknown as DB.PrismaClient
}

beforeAll(async () => {
  prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
  await requireDisposableDatabase(prisma)
  await prisma.$connect()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('APP_SECRET', randomUUID())
})

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await requireDisposableDatabase(prisma)

  if (fixtureIds.quizzes.length > 0) {
    await prisma.liveQuiz.updateMany({
      where: { id: { in: fixtureIds.quizzes } },
      data: { activeBlockId: null },
    })
  }

  if (fixtureIds.participants.length > 0) {
    await prisma.leaderboardEntry.deleteMany({
      where: { participantId: { in: fixtureIds.participants } },
    })
  }

  if (fixtureIds.users.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: fixtureIds.users } },
    })
  }

  if (fixtureIds.participants.length > 0) {
    await prisma.participant.deleteMany({
      where: { id: { in: fixtureIds.participants } },
    })
  }

  fixtureIds.users.length = 0
  fixtureIds.participants.length = 0
  fixtureIds.quizzes.length = 0
})

afterAll(async () => {
  await prisma?.$disconnect()
})

describe('controller audience feedback', () => {
  it('aggregates only responses strictly inside the recent window and preserves empty and missing results', async () => {
    const fixture = await createFixture()
    const { redis } = createRedisStub({ quizId: fixture.quizId })
    const { context } = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis,
    })
    const now = new Date('2026-10-23T12:00:00.000Z')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    const timestamps = [-60_000, -540_000, -600_000, -660_000, 0, 60_000]
    await prisma.confusionTimestep.createMany({
      data: timestamps.map((offset, index) => ({
        liveQuizId: fixture.quizId,
        createdAt: new Date(now.getTime() + offset),
        speed: index < 2 ? index * 2 : -2,
        difficulty: index < 2 ? index * -2 : 2,
      })),
    })

    const result = await getControlLiveQuizFeedbacks(
      { id: fixture.quizId },
      context
    )
    expect(result?.confusionSummary).toEqual({
      speed: 1,
      difficulty: -1,
      numberOfParticipants: 2,
    })
    expect(result?.confusionFeedbacks).toHaveLength(2)

    vi.setSystemTime(new Date(now.getTime() + 20 * 60_000))
    expect(
      (await getControlLiveQuizFeedbacks({ id: fixture.quizId }, context))
        ?.confusionSummary
    ).toEqual({ speed: 0, difficulty: 0, numberOfParticipants: 0 })
    expect(
      await getControlLiveQuizFeedbacks({ id: randomUUID() }, context)
    ).toBeNull()
    await prisma.liveQuiz.update({
      where: { id: fixture.quizId },
      data: { status: DB.PublicationStatus.ENDED },
    })
    expect(
      await getControlLiveQuizFeedbacks({ id: fixture.quizId }, context)
    ).toBeNull()
  })

  it('requires EXECUTE access to read audience feedback and change its flag independently of Q&A', async () => {
    const { schema } = await import('../src/index.js')
    const fixture = await createFixture()
    const { redis } = createRedisStub({ quizId: fixture.quizId })
    const { context } = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis,
    })
    await prisma.derivedPermission.create({
      data: {
        userId: fixture.ownerId,
        liveQuizId: fixture.quizId,
        permissionLevel: DB.PermissionLevel.EXECUTE,
      },
    })
    const query = `query Audience($id: String!) {
      controlLiveQuizFeedbacks(id: $id) {
        isConfusionFeedbackEnabled
        confusionSummary { speed difficulty numberOfParticipants }
      }
    }`
    const mutation = `mutation Audience($id: String!, $enabled: Boolean!) {
      changeLiveQuizSettings(id: $id, isConfusionFeedbackEnabled: $enabled) {
        isConfusionFeedbackEnabled
      }
    }`
    const execute = (source: string, enabled = true) =>
      graphql({
        schema,
        source,
        variableValues: { id: fixture.quizId, enabled },
        contextValue: context,
      })
    const prior = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.quizId },
    })
    const allowed = await execute(query)
    expect(allowed.errors).toBeUndefined()
    expect(allowed.data?.controlLiveQuizFeedbacks).toBeTruthy()
    expect((await execute(mutation)).data?.changeLiveQuizSettings).toEqual({
      isConfusionFeedbackEnabled: true,
    })
    const updated = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.quizId },
    })
    expect(updated.isLiveQAEnabled).toBe(prior.isLiveQAEnabled)
    expect(updated.isModerationEnabled).toBe(prior.isModerationEnabled)

    await prisma.derivedPermission.update({
      where: {
        liveQuizId_userId: {
          liveQuizId: fixture.quizId,
          userId: fixture.ownerId,
        },
      },
      data: { permissionLevel: DB.PermissionLevel.READ },
    })
    expect((await execute(query)).data?.controlLiveQuizFeedbacks).toBeNull()
    expect(
      (await execute(mutation, false)).data?.changeLiveQuizSettings
    ).toBeNull()
    expect(
      (
        await prisma.liveQuiz.findUniqueOrThrow({
          where: { id: fixture.quizId },
        })
      ).isConfusionFeedbackEnabled
    ).toBe(true)
  })
})

describe('live quiz lifecycle concurrency', () => {
  it.each([
    false,
    true,
  ])('keeps a later block active after a stale duplicate close (assessment=%s)', async (isAssessmentEnabled) => {
    const fixture = await createFixture()
    const firstQuestion = await addCloseQuestion(fixture)
    const nextBlock = await prisma.elementBlock.create({
      data: { liveQuizId: fixture.quizId, order: 1 },
    })
    const nextQuestion = await addCloseQuestion(fixture, nextBlock.id)
    await prisma.liveQuiz.update({
      where: { id: fixture.quizId },
      data: {
        isAssessmentEnabled,
        pinCode: isAssessmentEnabled ? randomUUID() : null,
      },
    })
    const hashes = {
      [`lq:${fixture.quizId}:i:${firstQuestion.id}:results`]: {
        participants: '3',
        '0': '3',
      },
      [`lq:${fixture.quizId}:i:${nextQuestion.id}:results`]: {
        participants: '5',
        '0': '5',
      },
    }
    const redis = createRedisStub({ quizId: fixture.quizId, hashes })
    const staleRedis = createRedisStub({
      quizId: fixture.quizId,
      hashes,
      holdFirstCacheRead: true,
    })
    const unusedRedis = createRedisStub({ quizId: fixture.quizId })
    const live = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis: redis.redis,
    })
    const stale = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis: staleRedis.redis,
    })
    if (isAssessmentEnabled) {
      live.context.redisExec = unusedRedis.redis
      stale.context.redisExec = unusedRedis.redis
    } else {
      live.context.redisAssessmentExec = unusedRedis.redis
      stale.context.redisAssessmentExec = unusedRedis.redis
    }
    await activateLiveQuizBlock(
      { quizId: fixture.quizId, blockId: fixture.blockId },
      live.context
    )
    const closing = deactivateLiveQuizBlock(
      { quizId: fixture.quizId, blockId: fixture.blockId },
      stale.context
    )
    try {
      await bounded(staleRedis.hold!.entered.promise, 'stale close cache read')
      expect(
        await deactivateLiveQuizBlock(
          { quizId: fixture.quizId, blockId: fixture.blockId },
          live.context
        )
      ).toBe(true)
      const firstClosed = await prisma.elementBlock.findUniqueOrThrow({
        where: { id: fixture.blockId },
      })
      await activateLiveQuizBlock(
        { quizId: fixture.quizId, blockId: nextBlock.id },
        live.context
      )
      staleRedis.hold!.release.resolve()
      expect(await bounded(closing, 'stale close result')).toBe(false)
      expect(
        await prisma.liveQuiz.findUniqueOrThrow({
          where: { id: fixture.quizId },
          select: { activeBlockId: true },
        })
      ).toEqual({ activeBlockId: nextBlock.id })
      expect(
        await prisma.elementBlock.findUniqueOrThrow({
          where: { id: fixture.blockId },
        })
      ).toEqual(firstClosed)
      expect(await endLiveQuiz({ id: fixture.quizId }, live.context)).toBeNull()
      expect(stale.pubSubPublish).not.toHaveBeenCalled()
      expect(stale.emitterEmit).not.toHaveBeenCalled()
      expect(staleRedis.pipelineCommands.hset).not.toHaveBeenCalled()
      expect(stale.taskSchedule.standard).not.toHaveBeenCalled()
      expect(stale.taskSchedule.assessment).not.toHaveBeenCalled()
      expect(unusedRedis.multi).not.toHaveBeenCalled()
      expect(
        await deactivateLiveQuizBlock(
          { quizId: fixture.quizId, blockId: nextBlock.id },
          live.context
        )
      ).toBe(true)
      const saved = await prisma.elementInstance.findUniqueOrThrow({
        where: { id: nextQuestion.id },
      })
      expect(
        isAssessmentEnabled ? saved.results : saved.anonymousResults
      ).toEqual({ choices: { 0: 5 }, total: 5 })
    } finally {
      staleRedis.hold!.release.resolve()
      await Promise.allSettled([closing])
    }
  })

  it.each([
    'execution',
    'activation',
  ] as const)('rolls back a stale close after waiting on a changed block %s', async (changedIdentity) => {
    const fixture = await createFixture()
    const question = await addCloseQuestion(fixture)
    const redis = createRedisStub({
      quizId: fixture.quizId,
      holdFirstCacheRead: true,
      hashes: {
        [`lq:${fixture.quizId}:i:${question.id}:results`]: {
          participants: '3',
          '0': '3',
        },
      },
    })
    const writeStarted = signal()
    const queryPrisma = instrumentPrisma({
      onLiveQuizUpdate: writeStarted.resolve,
      onLiveQuizUpdateMany: writeStarted.resolve,
    })
    const { context, pubSubPublish, emitterEmit, taskSchedule } = createContext(
      {
        ownerId: fixture.ownerId,
        client: prisma,
        redis: redis.redis,
      }
    )
    await activateLiveQuizBlock(
      { quizId: fixture.quizId, blockId: fixture.blockId },
      context
    )
    context.prisma = queryPrisma
    vi.clearAllMocks()
    const closing = deactivateLiveQuizBlock(
      { quizId: fixture.quizId, blockId: fixture.blockId },
      context
    )
    const locked = signal()
    const releaseReset = signal()
    let resetting: Promise<unknown> | undefined
    let blockerPid = 0
    try {
      await bounded(redis.hold!.entered.promise, 'old execution cache read')
      resetting = prisma.$transaction(async (tx) => {
        await tx.liveQuiz.update({
          where: { id: fixture.quizId },
          data: { activeBlockId: fixture.blockId },
        })
        const [backend] = await tx.$queryRaw<{ pid: number }[]>`
            SELECT pg_backend_pid() AS pid
          `
        blockerPid = backend!.pid
        locked.resolve()
        await releaseReset.promise
        await tx.elementBlock.update({
          where: { id: fixture.blockId },
          data:
            changedIdentity === 'execution'
              ? { execution: { increment: 1 } }
              : { startedAt: new Date(Date.now() + 60_000) },
        })
      })
      await bounded(locked.promise, 'competing execution lock')
      redis.hold!.release.resolve()
      await bounded(writeStarted.promise, 'stale close write')
      const lockDeadline = Date.now() + 4000
      let blocked = false
      while (!blocked && Date.now() < lockDeadline) {
        const [state] = await prisma.$queryRaw<{ blocked: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity
              WHERE ${blockerPid} = ANY(pg_blocking_pids(pid))
            ) AS blocked
          `
        blocked = state!.blocked
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20))
      }
      expect(blocked).toBe(true)
      releaseReset.resolve()
      await resetting
      expect(await bounded(closing, 'stale execution result')).toBe(false)
      expect(
        await prisma.liveQuiz.findUniqueOrThrow({
          where: { id: fixture.quizId },
          select: { activeBlockId: true },
        })
      ).toEqual({ activeBlockId: fixture.blockId })
      const block = await prisma.elementBlock.findUniqueOrThrow({
        where: { id: fixture.blockId },
      })
      expect(block.status).toBe(DB.ElementBlockStatus.ACTIVE)
      expect(block.closedAt).toBeNull()
      expect(
        (
          await prisma.elementInstance.findUniqueOrThrow({
            where: { id: question.id },
          })
        ).anonymousResults
      ).toEqual({ choices: {}, total: 0 })
      expect(pubSubPublish).not.toHaveBeenCalled()
      expect(emitterEmit).not.toHaveBeenCalled()
      expect(redis.pipelineCommands.hset).not.toHaveBeenCalled()
      expect(taskSchedule.standard).not.toHaveBeenCalled()
      expect(taskSchedule.assessment).not.toHaveBeenCalled()
    } finally {
      redis.hold!.release.resolve()
      releaseReset.resolve()
      await Promise.allSettled([closing, ...(resetting ? [resetting] : [])])
    }
  })

  it('rolls back a close claim when result persistence fails', async () => {
    const fixture = await createFixture()
    const question = await addCloseQuestion(fixture)
    const redis = createRedisStub({
      quizId: fixture.quizId,
      hashes: {
        [`lq:${fixture.quizId}:i:${question.id}:results`]: {
          participants: '3',
          '0': '3',
        },
      },
    })
    const live = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis: redis.redis,
    })
    await activateLiveQuizBlock(
      { quizId: fixture.quizId, blockId: fixture.blockId },
      live.context
    )
    const before = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.quizId },
      include: { blocks: { include: { elements: true } } },
    })
    const failure = new Error('Synthetic close persistence failure')
    const failing = createContext({
      ownerId: fixture.ownerId,
      client: instrumentPrisma({
        onLiveQuizUpdate() {
          throw failure
        },
      }),
      redis: redis.redis,
    })
    await expect(
      deactivateLiveQuizBlock(
        { quizId: fixture.quizId, blockId: fixture.blockId },
        failing.context
      )
    ).rejects.toBe(failure)
    expect(
      await prisma.liveQuiz.findUniqueOrThrow({
        where: { id: fixture.quizId },
        include: { blocks: { include: { elements: true } } },
      })
    ).toEqual(before)
    expect(failing.pubSubPublish).not.toHaveBeenCalled()
    expect(failing.emitterEmit).not.toHaveBeenCalled()
    expect(failing.taskSchedule.standard).not.toHaveBeenCalled()
    expect(failing.taskSchedule.assessment).not.toHaveBeenCalled()
  })

  it('holds end after its claim until commit, so competing activation rejects without activation side effects', async () => {
    const fixture = await createFixture({ withParticipant: true })
    const redis = createRedisStub({
      quizId: fixture.quizId,
      lb: { [fixture.participantId!]: '11' },
      xp: { [fixture.participantId!]: '7' },
      holdFirstRead: true,
    })
    const activationUpdateStarted = signal()
    const queryPrisma = instrumentPrisma({
      onLiveQuizUpdate: activationUpdateStarted.resolve,
    })
    const { context, pubSubPublish } = createContext({
      ownerId: fixture.ownerId,
      client: queryPrisma,
      redis: redis.redis,
    })

    const endPromise = endLiveQuiz({ id: fixture.quizId }, context)
    await bounded(redis.hold!.entered.promise, 'end reward read')

    const activationPromise = activateLiveQuizBlock(
      { quizId: fixture.quizId, blockId: fixture.blockId },
      context
    )
    await bounded(activationUpdateStarted.promise, 'activation claim')
    redis.hold!.release.resolve()

    const [endResult, activationResult] = await Promise.allSettled([
      endPromise,
      activationPromise,
    ])

    expect(endResult).toMatchObject({
      status: 'fulfilled',
      value: { status: DB.PublicationStatus.ENDED },
    })
    expect(activationResult.status).toBe('rejected')
    if (activationResult.status === 'rejected') {
      expect(activationResult.reason).toMatchObject({ code: 'P2025' })
    }
    expect(redis.hgetall.mock.calls).toEqual([
      [`lq:${fixture.quizId}:lb`],
      [`lq:${fixture.quizId}:xp`],
    ])
    expect(redis.pipeline).not.toHaveBeenCalled()
    expect(pubSubPublish).not.toHaveBeenCalled()
    expect(schedule.scheduleJob).not.toHaveBeenCalled()

    const quizState = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.quizId },
      include: { blocks: true },
    })
    expect(quizState).toMatchObject({
      status: DB.PublicationStatus.ENDED,
      activeBlockId: null,
    })
    expect(quizState.finishedAt).toBeInstanceOf(Date)
    expect(quizState.blocks).toEqual([
      expect.objectContaining({
        id: fixture.blockId,
        status: DB.ElementBlockStatus.SCHEDULED,
        startedAt: null,
        expiresAt: null,
      }),
    ])

    await expectAwards(fixture)
  })

  it('keeps the selected block active when activation wins before end', async () => {
    const fixture = await createFixture()
    const redis = createRedisStub({ quizId: fixture.quizId })
    const { context, pubSubPublish } = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis: redis.redis,
    })

    await activateLiveQuizBlock(
      { quizId: fixture.quizId, blockId: fixture.blockId },
      context
    )
    const result = await endLiveQuiz({ id: fixture.quizId }, context)

    expect(result).toBeNull()
    expect(redis.hgetall).not.toHaveBeenCalled()
    expect(redis.pipeline).toHaveBeenCalledTimes(1)
    expect(pubSubPublish).toHaveBeenCalledTimes(1)
    expect(schedule.scheduleJob).not.toHaveBeenCalled()

    const quizState = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.quizId },
      include: { blocks: true },
    })
    expect(quizState).toMatchObject({
      status: DB.PublicationStatus.PUBLISHED,
      activeBlockId: fixture.blockId,
      finishedAt: null,
    })
    expect(quizState.blocks).toEqual([
      expect.objectContaining({
        id: fixture.blockId,
        status: DB.ElementBlockStatus.ACTIVE,
        expiresAt: null,
      }),
    ])
    expect(quizState.blocks[0]!.startedAt).toBeInstanceOf(Date)
  })

  it('lets only one of two concurrent end calls award XP, course points, and timeline', async () => {
    const fixture = await createFixture({ withParticipant: true })
    const redis = createRedisStub({
      quizId: fixture.quizId,
      lb: { [fixture.participantId!]: '11' },
      xp: { [fixture.participantId!]: '7' },
      holdFirstRead: true,
    })
    const competingClaimStarted = signal()
    const queryPrisma = instrumentPrisma({
      onLiveQuizUpdateMany(call) {
        if (call === 2) competingClaimStarted.resolve()
      },
    })
    const { context } = createContext({
      ownerId: fixture.ownerId,
      client: queryPrisma,
      redis: redis.redis,
    })

    const firstEnd = endLiveQuiz({ id: fixture.quizId }, context)
    await bounded(redis.hold!.entered.promise, 'first end reward read')
    const secondEnd = endLiveQuiz({ id: fixture.quizId }, context)
    await bounded(competingClaimStarted.promise, 'competing end claim')
    redis.hold!.release.resolve()

    const results = await Promise.allSettled([firstEnd, secondEnd])
    expect(results).toEqual([
      expect.objectContaining({
        status: 'fulfilled',
        value: expect.objectContaining({ status: DB.PublicationStatus.ENDED }),
      }),
      expect.objectContaining({
        status: 'fulfilled',
        value: expect.objectContaining({ status: DB.PublicationStatus.ENDED }),
      }),
    ])
    expect(redis.hgetall.mock.calls).toEqual([
      [`lq:${fixture.quizId}:lb`],
      [`lq:${fixture.quizId}:xp`],
    ])

    const repeated = await endLiveQuiz({ id: fixture.quizId }, context)
    expect(repeated?.status).toBe(DB.PublicationStatus.ENDED)
    expect(redis.hgetall).toHaveBeenCalledTimes(2)

    await expectAwards(fixture)
  })

  it('rejects end without rewards while another block is active', async () => {
    const fixture = await createFixture({ withParticipant: true })
    await prisma.elementBlock.update({
      where: { id: fixture.blockId },
      data: {
        status: DB.ElementBlockStatus.ACTIVE,
        startedAt: new Date(),
      },
    })
    await prisma.liveQuiz.update({
      where: { id: fixture.quizId },
      data: { activeBlockId: fixture.blockId },
    })

    const before = await rewardSnapshot(fixture)
    const redis = createRedisStub({
      quizId: fixture.quizId,
      lb: { [fixture.participantId!]: '11' },
      xp: { [fixture.participantId!]: '7' },
    })
    const { context } = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis: redis.redis,
    })

    const result = await endLiveQuiz({ id: fixture.quizId }, context)

    expect(result).toBeNull()
    expect(redis.hgetall).not.toHaveBeenCalled()
    expect(await rewardSnapshot(fixture)).toEqual(before)

    const quizState = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: fixture.quizId },
      select: { status: true, activeBlockId: true, finishedAt: true },
    })
    expect(quizState).toEqual({
      status: DB.PublicationStatus.PUBLISHED,
      activeBlockId: fixture.blockId,
      finishedAt: null,
    })
  })

  it('ends an empty published quiz when no participant rewards exist', async () => {
    const fixture = await createFixture()
    const redis = createRedisStub({ quizId: fixture.quizId })
    const { context } = createContext({
      ownerId: fixture.ownerId,
      client: prisma,
      redis: redis.redis,
    })

    const result = await endLiveQuiz({ id: fixture.quizId }, context)

    expect(result).toMatchObject({
      id: fixture.quizId,
      status: DB.PublicationStatus.ENDED,
      activeBlockId: null,
    })
    expect(result?.finishedAt).toBeInstanceOf(Date)
    expect(redis.hgetall.mock.calls).toEqual([
      [`lq:${fixture.quizId}:lb`],
      [`lq:${fixture.quizId}:xp`],
    ])
    expect(
      await prisma.participation.findMany({
        where: { courseId: fixture.courseId },
        select: { id: true },
      })
    ).toEqual([])
  })

  it('rolls back the end claim and earlier rewards when timeline persistence fails', async () => {
    const fixture = await createFixture({ withParticipant: true })
    const before = await rewardSnapshot(fixture)
    const redis = createRedisStub({
      quizId: fixture.quizId,
      lb: { [fixture.participantId!]: '11' },
      xp: { [fixture.participantId!]: '7' },
    })
    const failure = new Error('Synthetic timeline write failure')
    const queryPrisma = instrumentPrisma({ failTimelineUpsert: failure })
    const { context } = createContext({
      ownerId: fixture.ownerId,
      client: queryPrisma,
      redis: redis.redis,
    })

    await expect(endLiveQuiz({ id: fixture.quizId }, context)).rejects.toBe(
      failure
    )

    expect(await rewardSnapshot(fixture)).toEqual(before)
    expect(
      await prisma.liveQuiz.findUniqueOrThrow({
        where: { id: fixture.quizId },
        select: {
          status: true,
          activeBlockId: true,
          finishedAt: true,
        },
      })
    ).toEqual({
      status: DB.PublicationStatus.PUBLISHED,
      activeBlockId: null,
      finishedAt: null,
    })
  })
})
