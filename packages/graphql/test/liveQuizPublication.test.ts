import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import { PrismaClient, PublicationStatus } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  clearLiveQuizScheduledPublicationTask,
  deleteLiveQuizScheduledPublicationTask,
  reconcileLiveQuizPublications,
} from '../src/services/liveQuizPublication.js'
import {
  handlePublishScheduledLiveQuiz,
  startLiveQuiz,
} from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Live quiz publication', () => {
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

  function createMetadataRedis({
    onExec,
    execError,
  }: {
    onExec?: () => Promise<void>
    execError?: Error
  } = {}) {
    const metadata: Record<string, string> = {}
    const redis = {
      async hset(
        _key: string,
        values: Record<string, string | number | boolean>
      ) {
        Object.assign(
          metadata,
          Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, String(value)])
          )
        )
        await onExec?.()
        if (execError) throw execError
        return 1
      },
    }

    return { metadata, redis }
  }
  it('publishes a scheduled quiz from its locked current settings', async () => {
    const scheduledQuiz = await seedLiveQuiz(
      {
        elements: [],
        status: PublicationStatus.SCHEDULED,
      },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: scheduledQuiz.id },
      data: {
        availableFrom: new Date(Date.now() - 60_000),
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
      },
    })

    let materializedAfterCommit = false
    const { metadata, redis } = createMetadataRedis({
      onExec: async () => {
        const stored = await prisma.liveQuiz.findUniqueOrThrow({
          where: { id: scheduledQuiz.id },
        })
        materializedAfterCommit =
          stored.status === PublicationStatus.PUBLISHED &&
          stored.startedAt !== null
      },
    })
    await expect(
      handlePublishScheduledLiveQuiz(
        { liveQuizId: scheduledQuiz.id },
        {
          ...userOneCtx,
          redisExec: redis,
          redisAssessmentExec: redis,
        } as any,
        { logger: { info: vi.fn() } } as any
      )
    ).resolves.toBe(true)

    const stored = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: scheduledQuiz.id },
    })
    expect(stored.status).toBe(PublicationStatus.PUBLISHED)
    expect(stored.scheduledPublicationTaskId).toBeNull()
    expect(stored.publicationMetadataMaterializedAt).not.toBeNull()
    expect(materializedAfterCommit).toBe(true)

    expect(metadata).toMatchObject({
      namespace: stored.namespace,
      startedAt: String(Number(stored.startedAt)),
      isGamificationEnabled: 'false',
      isAssessmentEnabled: 'false',
    })
  })

  it('repairs publication metadata when a manual start is retried', async () => {
    const liveQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const failedRedis = createMetadataRedis({
      execError: new Error('Redis unavailable'),
    }).redis

    await expect(
      startLiveQuiz({ id: liveQuiz.id }, {
        ...userOneCtx,
        redisExec: failedRedis,
        redisAssessmentExec: failedRedis,
      } as any)
    ).rejects.toThrow('Redis unavailable')

    const published = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
    })
    expect(published.status).toBe(PublicationStatus.PUBLISHED)
    expect(published.startedAt).not.toBeNull()
    expect(published.publicationMetadataMaterializedAt).toBeNull()

    const { metadata, redis } = createMetadataRedis()
    await expect(
      startLiveQuiz({ id: liveQuiz.id }, {
        ...userOneCtx,
        redisExec: redis,
        redisAssessmentExec: redis,
      } as any)
    ).resolves.toMatchObject({ id: liveQuiz.id })

    expect(metadata).toMatchObject({
      namespace: published.namespace,
      startedAt: String(Number(published.startedAt)),
      isGamificationEnabled: String(published.isGamificationEnabled),
      isAssessmentEnabled: String(published.isAssessmentEnabled),
    })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      publicationMetadataMaterializedAt: expect.any(Date),
    })
  })

  it('retains and eventually deletes a scheduled task after Redis recovers', async () => {
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [],
        status: PublicationStatus.SCHEDULED,
      },
      userOneCtx
    )
    const scheduledPublicationTaskId = '33333333-3333-4333-8333-333333333333'
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        availableFrom: new Date(Date.now() + 60_000),
        scheduledPublicationTaskId,
      },
    })
    const failedRedis = createMetadataRedis({
      execError: new Error('Redis unavailable'),
    }).redis
    const deletedTasks: string[] = []
    const ctx = {
      ...userOneCtx,
      hatchet: {
        scheduled: {
          delete: async (taskId: string) => {
            deletedTasks.push(taskId)
          },
        },
      },
    } as any

    await expect(
      startLiveQuiz(
        { id: liveQuiz.id },
        {
          ...ctx,
          redisExec: failedRedis,
          redisAssessmentExec: failedRedis,
        }
      )
    ).rejects.toThrow('Redis unavailable')
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      scheduledPublicationTaskId,
      publicationMetadataMaterializedAt: null,
    })
    expect(deletedTasks).toEqual([])

    const redis = createMetadataRedis().redis
    await startLiveQuiz(
      { id: liveQuiz.id },
      { ...ctx, redisExec: redis, redisAssessmentExec: redis }
    )

    expect(deletedTasks).toEqual([scheduledPublicationTaskId])
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      scheduledPublicationTaskId: null,
      publicationMetadataMaterializedAt: expect.any(Date),
    })
  })

  it('treats repeated same-generation task cleanup as successful', async () => {
    const liveQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const startedAt = new Date()
    const scheduledPublicationTaskId = '55555555-5555-4555-8555-555555555555'
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        status: PublicationStatus.PUBLISHED,
        startedAt,
        scheduledPublicationTaskId,
      },
    })

    let deletionCount = 0
    const deleteScheduledTask = async () => {
      deletionCount += 1
      if (deletionCount === 2) {
        throw { response: { status: 404 } }
      }
    }
    const cleanup = () =>
      deleteLiveQuizScheduledPublicationTask({
        prisma,
        liveQuizId: liveQuiz.id,
        startedAt,
        scheduledPublicationTaskId,
        deleteScheduledTask,
      })

    await expect(cleanup()).resolves.toBeUndefined()
    await expect(cleanup()).resolves.toBeUndefined()
    expect(deletionCount).toBe(2)
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({ scheduledPublicationTaskId: null })
  })

  it('does not clear a replacement task from the same publication generation', async () => {
    const liveQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const startedAt = new Date()
    const replacementTaskId = '66666666-6666-4666-8666-666666666666'
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        status: PublicationStatus.PUBLISHED,
        startedAt,
        scheduledPublicationTaskId: replacementTaskId,
      },
    })

    await expect(
      clearLiveQuizScheduledPublicationTask({
        prisma,
        liveQuizId: liveQuiz.id,
        startedAt,
        scheduledPublicationTaskId: '77777777-7777-4777-8777-777777777777',
      })
    ).rejects.toThrow('changed during scheduled publication cleanup')
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      scheduledPublicationTaskId: replacementTaskId,
    })
  })

  it('does not clear a task from a newer publication generation', async () => {
    const liveQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const previousStartedAt = new Date(Date.now() - 1_000)
    const currentStartedAt = new Date()
    const scheduledPublicationTaskId = '88888888-8888-4888-8888-888888888888'
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        status: PublicationStatus.PUBLISHED,
        startedAt: currentStartedAt,
        scheduledPublicationTaskId,
      },
    })

    await expect(
      clearLiveQuizScheduledPublicationTask({
        prisma,
        liveQuizId: liveQuiz.id,
        startedAt: previousStartedAt,
        scheduledPublicationTaskId,
      })
    ).rejects.toThrow('changed during scheduled publication cleanup')
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      startedAt: currentStartedAt,
      scheduledPublicationTaskId,
    })
  })

  it('repairs a published quiz without a persisted start timestamp', async () => {
    const liveQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        status: PublicationStatus.PUBLISHED,
        startedAt: null,
        publicationMetadataMaterializedAt: null,
      },
    })
    const { metadata, redis } = createMetadataRedis()

    await startLiveQuiz({ id: liveQuiz.id }, {
      ...userOneCtx,
      redisExec: redis,
      redisAssessmentExec: redis,
    } as any)

    const repaired = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
    })
    expect(repaired.startedAt).not.toBeNull()
    expect(repaired.publicationMetadataMaterializedAt).not.toBeNull()
    expect(metadata.startedAt).toBe(String(Number(repaired.startedAt)))
  })

  it('durably reconciles publication metadata after Redis recovery', async () => {
    const liveQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const startedAt = new Date()
    const firstAttemptAt = new Date('2026-07-30T12:00:00.000Z')
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        status: PublicationStatus.PUBLISHED,
        startedAt,
        publicationMetadataMaterializedAt: null,
      },
    })
    const failedRedis = createMetadataRedis({
      execError: new Error('Redis unavailable'),
    }).redis

    await expect(
      reconcileLiveQuizPublications({
        prisma,
        redisExec: failedRedis,
        redisAssessmentExec: failedRedis,
        deleteScheduledTask: async () => {},
        now: firstAttemptAt,
      })
    ).rejects.toThrow('Failed to reconcile 1 live quiz publication')
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      publicationMetadataMaterializedAt: null,
      publicationMetadataRetryAt: expect.any(Date),
    })

    const { metadata, redis } = createMetadataRedis()
    await expect(
      reconcileLiveQuizPublications({
        prisma,
        redisExec: redis,
        redisAssessmentExec: redis,
        deleteScheduledTask: async () => {},
        now: new Date(firstAttemptAt.getTime() + 5 * 60_000),
      })
    ).resolves.toBe(1)

    expect(metadata.startedAt).toBe(String(Number(startedAt)))
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      publicationMetadataMaterializedAt: expect.any(Date),
    })
  })

  it('does not acknowledge a newer publication generation', async () => {
    const liveQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const replacementTaskId = '44444444-4444-4444-8444-444444444444'
    const redis = createMetadataRedis({
      onExec: async () => {
        const current = await prisma.liveQuiz.findUniqueOrThrow({
          where: { id: liveQuiz.id },
        })
        await prisma.liveQuiz.update({
          where: { id: liveQuiz.id },
          data: {
            startedAt: new Date(current.startedAt!.getTime() + 1_000),
            publicationMetadataMaterializedAt: null,
            publicationMetadataRetryAt: null,
            scheduledPublicationTaskId: replacementTaskId,
          },
        })
      },
    }).redis

    await expect(
      startLiveQuiz({ id: liveQuiz.id }, {
        ...userOneCtx,
        redisExec: redis,
        redisAssessmentExec: redis,
      } as any)
    ).rejects.toThrow('changed during publication materialization')

    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      publicationMetadataMaterializedAt: null,
      scheduledPublicationTaskId: replacementTaskId,
    })
  })

  it('backs off a failed reconciliation so a healthy row can proceed', async () => {
    const retryNow = new Date('2026-07-30T12:00:00.000Z')
    const poisonQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const healthyQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: poisonQuiz.id },
      data: {
        status: PublicationStatus.PUBLISHED,
        startedAt: retryNow,
        publicationMetadataMaterializedAt: null,
        publicationMetadataRetryAt: null,
        updatedAt: new Date('2026-07-30T10:00:00.000Z'),
      },
    })
    await prisma.liveQuiz.update({
      where: { id: healthyQuiz.id },
      data: {
        status: PublicationStatus.PUBLISHED,
        startedAt: retryNow,
        publicationMetadataMaterializedAt: null,
        publicationMetadataRetryAt: null,
        updatedAt: new Date('2026-07-30T11:00:00.000Z'),
      },
    })

    const failedRedis = createMetadataRedis({
      execError: new Error('Permanent Redis failure'),
    }).redis
    await expect(
      reconcileLiveQuizPublications({
        prisma,
        redisExec: failedRedis,
        redisAssessmentExec: failedRedis,
        deleteScheduledTask: async () => {},
        batchSize: 1,
        now: retryNow,
      })
    ).rejects.toThrow('Failed to reconcile 1 live quiz publication')

    const redis = createMetadataRedis().redis
    await expect(
      reconcileLiveQuizPublications({
        prisma,
        redisExec: redis,
        redisAssessmentExec: redis,
        deleteScheduledTask: async () => {},
        batchSize: 1,
        now: retryNow,
      })
    ).resolves.toBe(1)

    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: poisonQuiz.id } })
    ).resolves.toMatchObject({
      publicationMetadataMaterializedAt: null,
      publicationMetadataRetryAt: new Date(retryNow.getTime() + 5 * 60_000),
    })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: healthyQuiz.id } })
    ).resolves.toMatchObject({
      publicationMetadataMaterializedAt: expect.any(Date),
      publicationMetadataRetryAt: null,
    })
  })
})
