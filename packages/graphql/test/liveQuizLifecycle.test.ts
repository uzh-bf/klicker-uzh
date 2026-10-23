import { randomUUID } from 'node:crypto'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
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
  endLiveQuiz,
} from '../src/services/liveQuizzes.js'

vi.mock('node-schedule', () => ({
  default: { scheduleJob: vi.fn() },
}))

vi.mock('../src/services/notifications.js', () => ({
  sendTeamsNotification: vi.fn(async () => undefined),
}))

let prisma: DB.PrismaClient

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
}

function createRedisStub({
  quizId,
  lb = {},
  xp = {},
  holdFirstRead = false,
}: RedisStubOptions) {
  const hgetallKeys: string[] = []
  const hold = holdFirstRead
    ? { entered: signal(), release: signal() }
    : undefined
  let isHeld = false

  const pipelineCommands = {
    hmset: vi.fn(),
    exec: vi.fn(async () => []),
  }
  const pipeline = vi.fn(() => pipelineCommands)
  const hgetall = vi.fn(async (key: string) => {
    hgetallKeys.push(key)
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
    redis: { hgetall, pipeline } as unknown as Redis,
    hgetall,
    hgetallKeys,
    pipeline,
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

  return { context, pubSubPublish }
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
})

afterEach(async () => {
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

describe('live quiz lifecycle concurrency', () => {
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
    expect(redis.hgetallKeys).toEqual([
      `lq:${fixture.quizId}:lb`,
      `lq:${fixture.quizId}:xp`,
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
    expect(redis.hgetallKeys).toEqual([
      `lq:${fixture.quizId}:lb`,
      `lq:${fixture.quizId}:xp`,
    ])

    const repeated = await endLiveQuiz({ id: fixture.quizId }, context)
    expect(repeated?.status).toBe(DB.PublicationStatus.ENDED)
    expect(redis.hgetallKeys).toHaveLength(2)

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
    expect(redis.hgetallKeys).toEqual([
      `lq:${fixture.quizId}:lb`,
      `lq:${fixture.quizId}:xp`,
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
