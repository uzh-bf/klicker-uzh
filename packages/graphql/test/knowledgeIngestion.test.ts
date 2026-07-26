import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import { KBResourceType, PrismaClient } from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createKb,
  createKbUrlResource,
  ingestKbResource,
} from '../src/services/knowledge.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('Integration tests for knowledge base ingestion', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let userTwoCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    userTwoCtx = initialized.userTwoCtx
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
  })

  it('clears prior external metadata when claiming a new attempt', async () => {
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
      },
    })
    const runNoWait = vi
      .spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait')
      .mockResolvedValue({} as never)

    const queued = await ingestKbResource({ id: resource.id }, userOneCtx)

    expect(queued).toMatchObject({
      status: 'QUEUED',
      statusMessage: null,
      ingestedAt: null,
      resourceVersion: 3,
      contentSha256: null,
      externalOperationId: null,
      externalOperationStartedAt: null,
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
        kBResource: {
          findFirst: kbResource.findFirst.bind(kbResource),
          updateMany: async (
            args: Parameters<typeof kbResource.updateMany>[0]
          ) => {
            await kbResource.update({
              where: { id: resource.id },
              data: {
                ingestionAttemptId: newerAttemptId,
                statusMessage: 'Newer same-status attempt',
              },
            })
            return kbResource.updateMany(args)
          },
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

  it('restores the complete pre-click snapshot when Hatchet dispatch fails', async () => {
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
      },
    })
    vi.spyOn(userOneCtx.tasks.ingestKBResource, 'runNoWait').mockRejectedValue(
      new Error('Hatchet unavailable')
    )

    await expect(
      ingestKbResource({ id: resource.id }, userOneCtx)
    ).rejects.toThrow('KB ingestion could not be queued')
    await expect(
      prisma.kBResource.findUnique({ where: { id: resource.id } })
    ).resolves.toMatchObject({
      status: 'FAILED',
      statusMessage: 'Previous external run failed',
      ingestedAt: oldIngestedAt,
      ingestionAttemptId: oldAttemptId,
      resourceVersion: 2,
      contentSha256: 'b'.repeat(64),
      externalOperationId: 'previous-operation-id',
      externalOperationStartedAt: oldExternalStartedAt,
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
})
