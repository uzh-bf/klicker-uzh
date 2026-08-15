import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementType,
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  PrismaClient,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { v4 as uuid } from 'uuid'
import type { ContextWithUser } from '../src/lib/context.js'
import { loginTemporaryParticipant } from '../src/services/accounts.js'
import {
  cancelLiveQuiz,
  clearAbortedLiveQuizRedisGeneration,
} from '../src/services/liveQuizzes.js'
import { materializeLiveQuizPublication } from '../src/services/liveQuizPublication.js'
import {
  initializePrisma,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Live quiz abort cleanup', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-app-secret'
    process.env.APP_ORIGIN_API =
      process.env.APP_ORIGIN_API ?? 'https://api.klicker.test'

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
  })

  afterEach(async () => await testCleanup(prisma))
  it('removes the temporary correlated dataset when a published quiz is aborted', async () => {
    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: ElementType.CONTENT,
        options: {},
        ownerId: userOneCtx.user.sub,
      },
    })
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [{ id: element.id, type: ElementType.CONTENT }],
        status: PublicationStatus.PUBLISHED,
      },
      userOneCtx
    )
    const startedAt = new Date()
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        exportSalt: 'test-export-salt',
        startedAt,
      },
    })
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlock: { liveQuizId: liveQuiz.id } },
    })
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        elementData: { type: ElementType.CONTENT, options: {} } as any,
        results: { total: 0 },
        anonymousResults: { total: 0 },
      },
    })
    const respondent = await prisma.liveQuizRespondent.create({
      data: {
        liveQuizId: liveQuiz.id,
        type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
        verificationSecretHash: 'test-verification-secret-hash',
      },
    })
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date(),
        response: { viewed: true },
        timeSpent: -1,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        elementBlockExecution: 0,
        instanceId: instance.id,
        respondentId: respondent.id,
      },
    })
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        responseKey: 'test-response-key',
        settledAt: new Date(),
      },
    })

    let receivedStartedAt: string | undefined
    let receivedPublicationGeneration: string | undefined
    let receivedTombstoneKey: string | undefined
    let metadataKey: string | undefined
    const redis = {
      eval: async (
        script: string,
        numberOfKeys: number,
        receivedMetadataKey: string,
        receivedTombstoneKeyArg: string,
        receivedPublicationGenerationArg: string,
        receivedStartedAtArg: string,
        pattern: string
      ) => {
        expect(script).toContain('currentStartedAt')
        expect(numberOfKeys).toBe(2)
        metadataKey = receivedMetadataKey
        receivedTombstoneKey = receivedTombstoneKeyArg
        receivedPublicationGeneration = receivedPublicationGenerationArg
        receivedStartedAt = receivedStartedAtArg
        expect(pattern).toBe(`lq:${liveQuiz.id}:*`)
        return 0
      },
    }
    await cancelLiveQuiz({ id: liveQuiz.id }, {
      ...userOneCtx,
      prisma,
      redisExec: redis,
      redisAssessmentExec: redis,
    } as any)

    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      status: PublicationStatus.DRAFT,
      startedAt: null,
    })
    await expect(
      prisma.liveQuizResponse.count({
        where: { instanceId: instance.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizRespondent.count({
        where: { liveQuizId: liveQuiz.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizPendingResponse.count({
        where: { liveQuizId: liveQuiz.id },
      })
    ).resolves.toBe(0)
    expect(metadataKey).toBe(`lq:${liveQuiz.id}:meta`)
    expect(receivedTombstoneKey).toBe(`lq:${liveQuiz.id}:aborted-generation`)
    expect(receivedPublicationGeneration).toBe('0')
    expect(receivedStartedAt).toBe(String(startedAt.getTime()))
  })

  it('does not recreate a correlated identity when abort wins the lifecycle lock', async () => {
    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: ElementType.CONTENT,
        options: {},
        ownerId: userOneCtx.user.sub,
      },
    })
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [{ id: element.id, type: ElementType.CONTENT }],
        status: PublicationStatus.PUBLISHED,
      },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        startedAt: new Date(),
      },
    })
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlock: { liveQuizId: liveQuiz.id } },
    })
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        elementData: { type: ElementType.CONTENT, options: {} } as any,
        results: { total: 0 },
        anonymousResults: { total: 0 },
      },
    })

    let releaseLock!: () => void
    let lockAcquired!: () => void
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    const lifecycleLockAcquired = new Promise<void>((resolve) => {
      lockAcquired = resolve
    })
    const lifecycleLock = prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "public"."LiveQuiz"
        WHERE "id" = ${liveQuiz.id}::uuid AND "isDeleted" = false
        FOR UPDATE
      `
      lockAcquired()
      await lockReleased
    })

    await lifecycleLockAcquired

    let abortLockRequested!: () => void
    const abortLockRequest = new Promise<void>((resolve) => {
      abortLockRequested = resolve
    })
    const abortPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === '$transaction') {
          return (callback: (transaction: unknown) => Promise<unknown>) =>
            target.$transaction(async (transaction) => {
              const instrumentedTransaction = new Proxy(transaction, {
                get(
                  transactionTarget,
                  transactionProperty,
                  transactionReceiver
                ) {
                  if (transactionProperty === '$queryRaw') {
                    return (...args: unknown[]) => {
                      const query = (transactionTarget.$queryRaw as any)(
                        ...args
                      )
                      abortLockRequested()
                      return query
                    }
                  }
                  const value = Reflect.get(
                    transactionTarget,
                    transactionProperty,
                    transactionReceiver
                  )
                  return typeof value === 'function'
                    ? value.bind(transactionTarget)
                    : value
                },
              })
              return callback(instrumentedTransaction)
            })
        }
        return Reflect.get(target, property, receiver)
      },
    })
    const redis = {
      eval: async () => 0,
    }
    const abort = cancelLiveQuiz({ id: liveQuiz.id }, {
      ...userOneCtx,
      prisma: abortPrisma,
      redisExec: redis,
      redisAssessmentExec: redis,
    } as any)

    await abortLockRequest
    const login = loginTemporaryParticipant(
      {
        liveQuizId: liveQuiz.id,
        pseudonym: `temporary-${uuid()}`,
      },
      {
        ...userOneCtx,
        res: { cookie: () => undefined } as any,
      }
    )

    releaseLock()
    await lifecycleLock
    await expect(abort).resolves.not.toBeNull()
    await expect(login).resolves.toBeNull()
    await expect(
      prisma.liveQuizRespondent.count({ where: { liveQuizId: liveQuiz.id } })
    ).resolves.toBe(0)
    await expect(
      prisma.temporaryLeaderboardEntry.count({
        where: { quizId: liveQuiz.id },
      })
    ).resolves.toBe(0)
  })

  it('preserves Redis keys from a newer publication generation', async () => {
    const liveQuizId = uuid()
    const oldStartedAt = new Date('2026-07-30T10:00:00.000Z')
    const newStartedAt = new Date('2026-07-30T11:00:00.000Z')
    const metaKey = `lq:${liveQuizId}:meta`
    const instanceKey = `lq:${liveQuizId}:i:42:info`
    const tombstoneKey = `lq:${liveQuizId}:aborted-generation`

    const redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: 1,
    })
    await redis.hset(metaKey, {
      publicationGeneration: '2',
      startedAt: String(newStartedAt.getTime()),
    })
    await redis.hset(instanceKey, { type: 'CONTENT' })

    try {
      await clearAbortedLiveQuizRedisGeneration({
        redis,
        liveQuizId,
        startedAt: oldStartedAt,
        publicationGeneration: 1,
      })

      await expect(redis.exists(metaKey)).resolves.toBe(1)
      await expect(redis.exists(instanceKey)).resolves.toBe(1)
    } finally {
      await redis.unlink(metaKey, instanceKey, tombstoneKey)
      redis.disconnect()
    }
  })

  it('blocks a late old publication while allowing a newer generation', async () => {
    const liveQuizId = uuid()
    const oldStartedAt = new Date('2026-07-30T10:00:00.000Z')
    const newStartedAt = oldStartedAt
    const tombstoneKey = `lq:${liveQuizId}:aborted-generation`
    const redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: 1,
    })
    const prisma = {
      liveQuiz: {
        updateMany: async () => ({ count: 1 }),
      },
    }

    try {
      await clearAbortedLiveQuizRedisGeneration({
        redis,
        liveQuizId,
        startedAt: oldStartedAt,
        publicationGeneration: 1,
      })

      await expect(
        materializeLiveQuizPublication({
          prisma: prisma as any,
          quiz: {
            id: liveQuizId,
            namespace: 'test',
            startedAt: oldStartedAt,
            publicationGeneration: 1,
            isGamificationEnabled: false,
            isAssessmentEnabled: false,
          },
          redisExec: redis,
          redisAssessmentExec: redis,
        })
      ).rejects.toThrow('changed during publication materialization')

      await expect(
        materializeLiveQuizPublication({
          prisma: prisma as any,
          quiz: {
            id: liveQuizId,
            namespace: 'test',
            startedAt: newStartedAt,
            publicationGeneration: 2,
            isGamificationEnabled: true,
            isAssessmentEnabled: false,
          },
          redisExec: redis,
          redisAssessmentExec: redis,
        })
      ).resolves.toBeUndefined()
      await expect(
        redis.hgetall(`lq:${liveQuizId}:meta`)
      ).resolves.toMatchObject({
        publicationGeneration: '2',
        startedAt: String(newStartedAt.getTime()),
      })
    } finally {
      await redis.unlink(`lq:${liveQuizId}:meta`, tombstoneKey)
      redis.disconnect()
    }
  })
})
