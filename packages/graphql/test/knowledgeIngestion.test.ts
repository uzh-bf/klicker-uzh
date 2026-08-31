import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
  KBResourceType,
  PrismaClient,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { randomUUID } from 'node:crypto'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createKb,
  createKbUrlResource,
  ingestAllKbResources,
  ingestKbResource,
} from '../src/services/knowledge.js'
import { testCleanup, testInitialization } from './helpers.js'

const previousManageAiEnvironment = vi.hoisted(() => {
  const previousGrowthbookEnvironment = process.env.GROWTHBOOK_ENV
  const previousFeatureFlagsForcedOn = process.env.FEATURE_FLAGS_FORCED_ON
  process.env.GROWTHBOOK_ENV = 'development'
  process.env.FEATURE_FLAGS_FORCED_ON = 'ai-beta'

  return {
    previousGrowthbookEnvironment,
    previousFeatureFlagsForcedOn,
  }
})

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('Integration tests for knowledge base ingestion', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    prisma = prismaClient
    await testCleanup(prisma)
    hatchet = {
      task: vi.fn(() => ({ runNoWait: vi.fn() })),
    } as unknown as Hatchet
    emitter = new EventEmitter()
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
    if (
      previousManageAiEnvironment.previousGrowthbookEnvironment === undefined
    ) {
      delete process.env.GROWTHBOOK_ENV
    } else {
      process.env.GROWTHBOOK_ENV =
        previousManageAiEnvironment.previousGrowthbookEnvironment
    }
    if (
      previousManageAiEnvironment.previousFeatureFlagsForcedOn === undefined
    ) {
      delete process.env.FEATURE_FLAGS_FORCED_ON
    } else {
      process.env.FEATURE_FLAGS_FORCED_ON =
        previousManageAiEnvironment.previousFeatureFlagsForcedOn
    }
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
    await prisma.user.updateMany({
      where: { id: { in: [userOneCtx.user.sub, userTwoCtx.user.sub] } },
      data: { aiFeaturesEnabled: true },
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await testCleanup(prisma)
  })

  it('queues an owned URL resource with a fresh attempt', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/course',
      },
      userOneCtx
    )
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    const queued = await ingestKbResource({ id: resource.id }, userOneCtx)

    expect(queued).toMatchObject({
      status: 'QUEUED',
      ingestionAttemptId: expect.stringMatching(UUID_PATTERN),
      resourceVersion: 1,
    })
    expect(runNoWait).toHaveBeenCalledWith({
      resourceId: resource.id,
      kbId: created.id,
      type: 'URL',
      title: 'Lecture recording',
      sourceUrl: 'https://video.example.com/course',
      ingestionAttemptId: queued.ingestionAttemptId,
      resourceVersion: 1,
    })
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      status: 'QUEUED',
      ingestionAttemptId: queued.ingestionAttemptId,
      resourceVersion: 1,
    })
    await expect(
      prisma.kBIngestionRun.findUnique({
        where: { id: queued.ingestionAttemptId! },
      })
    ).resolves.toMatchObject({
      resourceId: resource.id,
      resourceVersion: 1,
      status: 'QUEUED',
    })
  })

  it('claims a new attempt while preserving active serving metadata', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/course',
      },
      userOneCtx
    )
    const oldAttemptId = '1f9aa27b-ee62-4b52-9c76-5f9f024347fd'
    const ingestedAt = new Date('2026-07-19T12:00:00.000Z')
    await prisma.kBResource.update({
      where: { id: resource.id },
      data: {
        status: 'READY',
        statusMessage: 'Previous ingestion completed',
        ingestedAt,
        ingestionAttemptId: oldAttemptId,
        resourceVersion: 2,
        contentSha256: 'a'.repeat(64),
        externalOperationId: 'old-operation-id',
        externalOperationStartedAt: new Date('2026-07-19T11:30:00.000Z'),
        activeResourceVersion: 2,
        activeContentSha256: 'a'.repeat(64),
      },
    })
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    const queued = await ingestKbResource({ id: resource.id }, userOneCtx)

    expect(queued).toMatchObject({
      status: 'QUEUED',
      statusMessage: null,
      ingestedAt,
      resourceVersion: 3,
      contentSha256: null,
      externalOperationId: null,
      externalOperationStartedAt: null,
      activeResourceVersion: 2,
      activeContentSha256: 'a'.repeat(64),
    })
    expect(queued.ingestionAttemptId).toMatch(UUID_PATTERN)
    expect(queued.ingestionAttemptId).not.toBe(oldAttemptId)
    expect(runNoWait).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestionAttemptId: queued.ingestionAttemptId,
        resourceVersion: 3,
      })
    )
  })

  it('queues a READY blob resource with its private container location', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.BLOB,
        title: 'Finance notes',
        originalFilename: 'notes.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        blobName: '79a40d25-78cf-4bde-9661-a07747d7b715.pdf',
        blobHref:
          'https://kbtestaccount.blob.core.windows.net/container/notes.pdf',
        status: 'READY',
      },
    })
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    const queued = await ingestKbResource({ id: resource.id }, userOneCtx)

    expect(queued.status).toBe('QUEUED')
    expect(runNoWait).toHaveBeenCalledWith({
      resourceId: resource.id,
      kbId: created.id,
      type: 'BLOB',
      title: 'Finance notes',
      blobName: resource.blobName,
      containerName: `kb-${userOneCtx.user.sub}`,
      ingestionAttemptId: queued.ingestionAttemptId,
      resourceVersion: 1,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    })
  })

  it('denies foreign or already active resources without dispatching', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/course',
      },
      userOneCtx
    )
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    await expect(
      ingestKbResource({ id: resource.id }, userTwoCtx)
    ).rejects.toThrow('KB resource not found')
    await prisma.kBResource.update({
      where: { id: resource.id },
      data: { status: 'PROCESSING' },
    })
    await expect(
      ingestKbResource({ id: resource.id }, userOneCtx)
    ).rejects.toThrow('KB resource cannot be ingested')
    expect(runNoWait).not.toHaveBeenCalled()
  })

  it('claims a resource once when ingestion requests race', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/course',
      },
      userOneCtx
    )
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    const results = await Promise.allSettled([
      ingestKbResource({ id: resource.id }, userOneCtx),
      ingestKbResource({ id: resource.id }, userOneCtx),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1)
    expect(runNoWait).toHaveBeenCalledTimes(1)
    const dispatchedAttemptId = (
      runNoWait.mock.calls[0]?.[0] as unknown as {
        ingestionAttemptId: string
      }
    ).ingestionAttemptId
    expect(dispatchedAttemptId).toMatch(UUID_PATTERN)
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      status: 'QUEUED',
      ingestionAttemptId: dispatchedAttemptId,
      resourceVersion: 1,
    })
    await expect(
      prisma.kBIngestionRun.count({ where: { resourceId: resource.id } })
    ).resolves.toBe(1)
  })

  it('rejects an ABA claim when the observed attempt changes at the same status', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const observedAttemptId = '60bf5833-1a03-4586-a9a0-f7e1ea0f7eef'
    const newerAttemptId = '9c739b93-4f48-4f0d-bac1-5db4e27c821d'
    const resource = await prisma.kBResource.create({
      data: {
        kbId: created.id,
        type: KBResourceType.URL,
        title: 'Lecture recording',
        sourceUrl: 'https://video.example.com/course',
        status: 'READY',
        ingestionAttemptId: observedAttemptId,
      },
    })
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)
    const kbResource = prisma.kBResource
    const abaCtx = {
      ...userOneCtx,
      prisma: {
        user: {
          findUnique: userOneCtx.prisma.user.findUnique.bind(
            userOneCtx.prisma.user
          ),
        },
        kBResource: {
          findFirst: kbResource.findFirst.bind(kbResource),
        },
        $transaction: async <T>(
          callback: (tx: {
            kBResource: {
              updateMany: (
                args: Parameters<typeof kbResource.updateMany>[0]
              ) => Promise<{ count: number }>
            }
            kBIngestionRun: {
              create: (
                args: Parameters<typeof prisma.kBIngestionRun.create>[0]
              ) => Promise<unknown>
            }
          }) => Promise<T>
        ) => {
          await prisma.kBResource.update({
            where: { id: resource.id },
            data: {
              ingestionAttemptId: newerAttemptId,
              statusMessage: 'Newer same-status attempt',
            },
          })
          return prisma.$transaction(async (tx) =>
            callback({
              kBResource: {
                updateMany: async (args) => tx.kBResource.updateMany(args),
              },
              kBIngestionRun: {
                create: async (args) => tx.kBIngestionRun.create(args),
              },
            })
          )
        },
      },
    } as unknown as ContextWithUser

    await expect(ingestKbResource({ id: resource.id }, abaCtx)).rejects.toThrow(
      'KB resource cannot be ingested'
    )
    expect(runNoWait).not.toHaveBeenCalled()
    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      status: 'READY',
      statusMessage: 'Newer same-status attempt',
      ingestionAttemptId: newerAttemptId,
    })
  })

  it('records a failed attempt when Hatchet queue dispatch fails', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/course',
      },
      userOneCtx
    )
    const oldAttemptId = '3b894217-e5dc-4d39-a94d-b21b08f4725e'
    const oldIngestedAt = new Date('2026-07-18T09:00:00.000Z')
    const oldExternalStartedAt = new Date('2026-07-18T08:30:00.000Z')
    await prisma.kBResource.update({
      where: { id: resource.id },
      data: {
        status: 'FAILED',
        statusMessage: 'Previous external run failed',
        ingestedAt: oldIngestedAt,
        ingestionAttemptId: oldAttemptId,
        resourceVersion: 2,
        contentSha256: 'b'.repeat(64),
        externalOperationId: 'previous-operation-id',
        externalOperationStartedAt: oldExternalStartedAt,
        activeResourceVersion: 1,
        activeContentSha256: 'c'.repeat(64),
      },
    })
    vi.spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait').mockRejectedValue(
      new Error('Hatchet unavailable')
    )

    await expect(
      ingestKbResource({ id: resource.id }, userOneCtx)
    ).rejects.toThrow('KB ingestion could not be queued')
    const failed = await prisma.kBResource.findUniqueOrThrow({
      where: { id: resource.id },
    })
    expect(failed).toMatchObject({
      status: 'FAILED',
      statusMessage: 'The ingestion operation could not be queued.',
      ingestedAt: oldIngestedAt,
      ingestionAttemptId: expect.stringMatching(UUID_PATTERN),
      resourceVersion: 3,
      contentSha256: null,
      externalOperationId: null,
      externalOperationStartedAt: null,
      activeResourceVersion: 1,
      activeContentSha256: 'c'.repeat(64),
      errorCode: 'QUEUE_DISPATCH_FAILED',
    })
    expect(failed.ingestionAttemptId).not.toBe(oldAttemptId)
    await expect(
      prisma.kBIngestionRun.findUniqueOrThrow({
        where: { id: failed.ingestionAttemptId! },
      })
    ).resolves.toMatchObject({
      status: 'FAILED',
      resourceId: resource.id,
      resourceVersion: 3,
      errorCode: 'QUEUE_DISPATCH_FAILED',
      finishedAt: expect.any(Date),
    })
  })

  it('does not roll back a resource that advanced after dispatch began', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/course',
      },
      userOneCtx
    )
    vi.spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait').mockImplementation(
      async () => {
        await prisma.kBResource.update({
          where: { id: resource.id },
          data: { status: 'PROCESSING' },
        })
        throw new Error('Hatchet response lost')
      }
    )

    await expect(
      ingestKbResource({ id: resource.id }, userOneCtx)
    ).rejects.toThrow('KB ingestion could not be queued')
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({ status: 'PROCESSING' })
  })

  it('does not let a stale dispatch failure roll back a newer queued attempt', async () => {
    const created = await createKb({ name: 'Finance notes' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Lecture recording',
        url: 'https://video.example.com/course',
      },
      userOneCtx
    )
    const newerAttemptId = '7adf2e60-82b8-436a-90bd-ae6eb142385a'
    const newerStartedAt = new Date('2026-07-20T08:30:00.000Z')
    vi.spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait').mockImplementation(
      async () => {
        await prisma.kBResource.update({
          where: { id: resource.id },
          data: {
            ingestionAttemptId: newerAttemptId,
            resourceVersion: 2,
            externalOperationId: 'newer-operation-id',
            externalOperationStartedAt: newerStartedAt,
            statusMessage: 'Newer attempt accepted',
          },
        })
        throw new Error('Stale Hatchet response lost')
      }
    )

    await expect(
      ingestKbResource({ id: resource.id }, userOneCtx)
    ).rejects.toThrow('KB ingestion could not be queued')
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      status: 'QUEUED',
      statusMessage: 'Newer attempt accepted',
      ingestionAttemptId: newerAttemptId,
      resourceVersion: 2,
      externalOperationId: 'newer-operation-id',
      externalOperationStartedAt: newerStartedAt,
    })
  })

  it('queues only resources that need the current version', async () => {
    const created = await createKb({ name: 'Bulk ingestion' }, userOneCtx)
    const resources = await Promise.all(
      ['added', 'failed', 'current', 'processing', 'stale'].map((name) =>
        createKbUrlResource(
          {
            kbId: created.id,
            title: name,
            url: `https://example.com/${name}`,
          },
          userOneCtx
        )
      )
    )
    const [added, failed, current, processing, stale] = resources as [
      (typeof resources)[number],
      (typeof resources)[number],
      (typeof resources)[number],
      (typeof resources)[number],
      (typeof resources)[number],
    ]
    await expect(
      ingestAllKbResources({ kbId: created.id }, userTwoCtx)
    ).rejects.toThrow('KB not found')
    const failedAttemptId = randomUUID()
    const currentAttemptId = randomUUID()
    const processingAttemptId = randomUUID()

    await prisma.kBResource.update({
      where: { id: failed.id },
      data: {
        status: KBResourceStatus.FAILED,
        ingestionAttemptId: failedAttemptId,
        resourceVersion: 1,
      },
    })
    await prisma.kBIngestionRun.create({
      data: {
        id: failedAttemptId,
        resourceId: failed.id,
        operation: KBIngestionOperation.UPSERT,
        resourceVersion: 1,
        status: KBIngestionStatus.FAILED,
      },
    })
    await prisma.kBResource.update({
      where: { id: current.id },
      data: {
        status: KBResourceStatus.READY,
        ingestionAttemptId: currentAttemptId,
        resourceVersion: 1,
        contentSha256: 'a'.repeat(64),
        activeResourceVersion: 1,
        activeContentSha256: 'a'.repeat(64),
        ingestedAt: new Date(),
      },
    })
    await prisma.kBIngestionRun.create({
      data: {
        id: currentAttemptId,
        resourceId: current.id,
        operation: KBIngestionOperation.UPSERT,
        resourceVersion: 1,
        status: KBIngestionStatus.SUCCEEDED,
      },
    })
    await prisma.kBResource.update({
      where: { id: processing.id },
      data: {
        status: KBResourceStatus.PROCESSING,
        ingestionAttemptId: processingAttemptId,
      },
    })
    await prisma.kBIngestionRun.create({
      data: {
        id: processingAttemptId,
        resourceId: processing.id,
        operation: KBIngestionOperation.UPSERT,
        resourceVersion: 1,
        status: KBIngestionStatus.PROCESSING,
      },
    })
    await prisma.kBResource.update({
      where: { id: stale.id },
      data: {
        status: KBResourceStatus.READY,
        resourceVersion: 2,
        contentSha256: 'b'.repeat(64),
        activeResourceVersion: 1,
        activeContentSha256: 'a'.repeat(64),
      },
    })

    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    await expect(
      ingestAllKbResources({ kbId: created.id }, userOneCtx)
    ).resolves.toEqual({
      queuedCount: 3,
      retriedFailedCount: 1,
      alreadyCurrentCount: 1,
      alreadyInProgressCount: 1,
      queueFailureCount: 0,
    })
    expect(runNoWait).toHaveBeenCalledTimes(3)
    expect(
      runNoWait.mock.calls.map(
        ([payload]) => (payload as unknown as { resourceId: string }).resourceId
      )
    ).toEqual(expect.arrayContaining([added.id, failed.id, stale.id]))

    await expect(
      prisma.kBResource.findMany({
        where: { id: { in: [added.id, failed.id, stale.id] } },
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: KBResourceStatus.QUEUED }),
      ])
    )

    await expect(
      ingestAllKbResources({ kbId: created.id }, userOneCtx)
    ).resolves.toEqual({
      queuedCount: 0,
      retriedFailedCount: 0,
      alreadyCurrentCount: 1,
      alreadyInProgressCount: 4,
      queueFailureCount: 0,
    })
    expect(runNoWait).toHaveBeenCalledTimes(3)
  })

  it('does not downgrade a newer provider-served revision', async () => {
    const created = await createKb({ name: 'Provider refresh' }, userOneCtx)
    const resource = await createKbUrlResource(
      {
        kbId: created.id,
        title: 'Provider refresh',
        url: 'https://example.com/provider-refresh',
      },
      userOneCtx
    )
    await prisma.kBResource.update({
      where: { id: resource.id },
      data: {
        status: KBResourceStatus.READY,
        resourceVersion: 1,
        activeResourceVersion: 2,
        activeContentSha256: 'a'.repeat(64),
      },
    })
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    await expect(
      ingestAllKbResources({ kbId: created.id }, userOneCtx)
    ).resolves.toEqual({
      queuedCount: 0,
      retriedFailedCount: 0,
      alreadyCurrentCount: 1,
      alreadyInProgressCount: 0,
      queueFailureCount: 0,
    })
    expect(runNoWait).not.toHaveBeenCalled()
  })

  it('converges concurrent bulk requests on one claim per resource', async () => {
    const created = await createKb(
      { name: 'Concurrent bulk ingestion' },
      userOneCtx
    )
    const resources = await Promise.all(
      ['first', 'second'].map((name) =>
        createKbUrlResource(
          {
            kbId: created.id,
            title: name,
            url: `https://example.com/concurrent-${name}`,
          },
          userOneCtx
        )
      )
    )
    const dispatchStarted = createDeferred<void>()
    const releaseDispatch = createDeferred<void>()
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockImplementation(async () => {
        dispatchStarted.resolve()
        await releaseDispatch.promise
        return {} as never
      })

    const first = ingestAllKbResources({ kbId: created.id }, userOneCtx)
    await dispatchStarted.promise
    const second = ingestAllKbResources({ kbId: created.id }, userOneCtx)

    await expect(second).resolves.toEqual({
      queuedCount: 0,
      retriedFailedCount: 0,
      alreadyCurrentCount: 0,
      alreadyInProgressCount: 2,
      queueFailureCount: 0,
    })
    releaseDispatch.resolve()
    await expect(first).resolves.toEqual({
      queuedCount: 2,
      retriedFailedCount: 0,
      alreadyCurrentCount: 0,
      alreadyInProgressCount: 0,
      queueFailureCount: 0,
    })
    expect(runNoWait).toHaveBeenCalledTimes(resources.length)
    await expect(
      prisma.kBIngestionRun.count({
        where: { resourceId: { in: resources.map(({ id }) => id) } },
      })
    ).resolves.toBe(2)
  })

  it('compensates only failed bulk dispatches', async () => {
    const created = await createKb(
      { name: 'Bulk dispatch failures' },
      userOneCtx
    )
    const resources = await Promise.all(
      ['first', 'second'].map((name) =>
        createKbUrlResource(
          {
            kbId: created.id,
            title: name,
            url: `https://example.com/${name}`,
          },
          userOneCtx
        )
      )
    )
    const failingId = resources[0]!.id
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockImplementation(async (payload) => {
        if (
          (payload as unknown as { resourceId: string }).resourceId ===
          failingId
        ) {
          throw new Error('Hatchet unavailable')
        }
        return {} as never
      })

    await expect(
      ingestAllKbResources({ kbId: created.id }, userOneCtx)
    ).resolves.toMatchObject({
      queuedCount: 1,
      retriedFailedCount: 0,
      alreadyCurrentCount: 0,
      alreadyInProgressCount: 0,
      queueFailureCount: 1,
    })
    expect(runNoWait).toHaveBeenCalledTimes(2)
    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: failingId } })
    ).resolves.toMatchObject({
      status: KBResourceStatus.FAILED,
      errorCode: 'QUEUE_DISPATCH_FAILED',
    })
    await expect(
      prisma.kBResource.findUniqueOrThrow({ where: { id: resources[1]!.id } })
    ).resolves.toMatchObject({ status: KBResourceStatus.QUEUED })
  })
})
