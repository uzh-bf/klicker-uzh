import { prisma } from '@klicker-uzh/prisma'
import {
  ElementStatus,
  ElementType,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../src/lib/context.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import {
  MAX_IMPORT_EXPORT_CONTENT_LENGTH,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
} from '../src/lib/importExportPackageConfig.js'
import { loadElementExportSnapshot } from '../src/services/elementExportSnapshot.js'

import {
  restoreEnvironmentVariable,
  waitForBarrier,
  withAnswerCollectionReadBarrier,
  withElementMaterializationCounter,
  withElementReadBarrier,
} from './elementExportSnapshotTestSupport.js'

describe('coherent element export snapshots and publication', () => {
  const originalEnabled = process.env.IMPORT_EXPORT_ENABLED
  const originalPrivatePreview = process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY
  let ownerId: string
  let ctx: ContextWithUser
  let collectionId: number
  let oldEntryId: number
  let newEntryId: number
  let elementId: number

  beforeEach(async () => {
    process.env.IMPORT_EXPORT_ENABLED = 'true'
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
    ownerId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        name: 'Export snapshot owner',
        email: `export-snapshot-${ownerId}@example.invalid`,
        shortname: `export-snapshot-${ownerId.slice(0, 8)}`,
        role: UserRole.USER,
        privatePreview: true,
      },
    })
    const collection = await prisma.answerCollection.create({
      data: {
        name: 'Snapshot collection',
        description: 'Snapshot collection description',
        ownerId,
        entries: {
          create: [{ value: 'Old selected entry' }, { value: 'New entry' }],
        },
      },
      include: { entries: { orderBy: { value: 'asc' } } },
    })
    collectionId = collection.id
    newEntryId = collection.entries[0]!.id
    oldEntryId = collection.entries[1]!.id
    const element = await prisma.element.create({
      data: {
        name: 'Snapshot selection',
        content: 'Old coherent content',
        explanation: 'Old coherent explanation',
        type: ElementType.SELECTION,
        status: ElementStatus.READY,
        options: { hasSampleSolution: true, numberOfInputs: 1 },
        basePoints: true,
        pointsMultiplier: 1,
        ownerId,
        answerCollectionId: collectionId,
        answerCollectionItems: { connect: { id: oldEntryId } },
      },
    })
    elementId = element.id
    await prisma.derivedPermission.createMany({
      data: [
        {
          userId: ownerId,
          elementId,
          permissionLevel: PermissionLevel.OWNER,
        },
        {
          userId: ownerId,
          answerCollectionId: collectionId,
          permissionLevel: PermissionLevel.OWNER,
        },
      ],
    })
    ctx = {
      user: {
        sub: ownerId,
        role: UserRole.USER,
        scope: UserLoginScope.FULL_ACCESS,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
      prisma,
      emitter: { emit: vi.fn() },
      tasks: {
        refreshImportExportFingerprints: {
          runNoWait: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as unknown as ContextWithUser
  })

  afterEach(async () => {
    await prisma.importExportPackageArtifact.deleteMany({
      where: { ownerId },
    })
    await prisma.user.deleteMany({ where: { id: ownerId } })
    restoreEnvironmentVariable('IMPORT_EXPORT_ENABLED', originalEnabled)
    restoreEnvironmentVariable(
      'IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY',
      originalPrivatePreview
    )
  })

  it('keeps a same-count selected relation swap in one repeatable-read snapshot', async () => {
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM "_ElementAnswerCollectionUsedItems"
          WHERE "A" = ${oldEntryId} AND "B" = ${elementId}
        `
        await tx.$executeRaw`
          INSERT INTO "_ElementAnswerCollectionUsedItems" ("A", "B")
          VALUES (${newEntryId}, ${elementId})
        `
      })
    } finally {
      barrier.resume.resolve()
    }

    const oldSnapshot = await snapshotPromise
    expect(oldSnapshot.elements[0]).toMatchObject({
      content: 'Old coherent content',
      explanation: 'Old coherent explanation',
      answerCollectionItems: [{ id: oldEntryId }],
    })

    const newSnapshot = await loadElementExportSnapshot([elementId], ctx)
    expect(newSnapshot.elements[0]).toMatchObject({
      content: 'Old coherent content',
      explanation: 'Old coherent explanation',
      answerCollectionItems: [{ id: newEntryId }],
    })
    expect(newSnapshot.revision.token).not.toBe(oldSnapshot.revision.token)
  })

  it('keeps content and options from one database snapshot', async () => {
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.$executeRaw`
        UPDATE "Element"
        SET
          "content" = ${'New coherent content'},
          "options" = ${JSON.stringify({
            hasSampleSolution: false,
            numberOfInputs: 2,
          })}::jsonb
        WHERE "id" = ${elementId}
      `
    } finally {
      barrier.resume.resolve()
    }

    const oldSnapshot = await snapshotPromise
    expect(oldSnapshot.elements[0]).toMatchObject({
      content: 'Old coherent content',
      options: { hasSampleSolution: true, numberOfInputs: 1 },
    })
    const newSnapshot = await loadElementExportSnapshot([elementId], ctx)
    expect(newSnapshot.elements[0]).toMatchObject({
      content: 'New coherent content',
      options: { hasSampleSolution: false, numberOfInputs: 2 },
    })
    expect(newSnapshot.revision.token).not.toBe(oldSnapshot.revision.token)
  })

  it('keeps collection metadata and entry values from one database snapshot', async () => {
    const barrier = withAnswerCollectionReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(
      barrier.afterFirstCollectionRead.promise,
      snapshotPromise
    )

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "AnswerCollection"
          SET "name" = ${'New collection name'}
          WHERE "id" = ${collectionId}
        `
        await tx.$executeRaw`
          UPDATE "AnswerCollectionEntry"
          SET "value" = ${'Changed selected entry'}
          WHERE "id" = ${oldEntryId}
        `
      })
    } finally {
      barrier.resume.resolve()
    }

    const oldSnapshot = await snapshotPromise
    expect(oldSnapshot.answerCollections[0]).toMatchObject({
      name: 'Snapshot collection',
      entries: expect.arrayContaining([
        expect.objectContaining({
          id: oldEntryId,
          value: 'Old selected entry',
        }),
      ]),
    })
    const newSnapshot = await loadElementExportSnapshot([elementId], ctx)
    expect(newSnapshot.answerCollections[0]).toMatchObject({
      name: 'New collection name',
      entries: expect.arrayContaining([
        expect.objectContaining({
          id: oldEntryId,
          value: 'Changed selected entry',
        }),
      ]),
    })
    expect(newSnapshot.revision.token).not.toBe(oldSnapshot.revision.token)
  })

  it('keeps later element batches on the same repeatable-read database snapshot', async () => {
    const elements = await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        prisma.element.create({
          data: {
            name: `Batched snapshot element ${index + 1}`,
            content: `Old batched content ${index + 1}`,
            type: ElementType.CONTENT,
            status: ElementStatus.READY,
            options: {},
            basePoints: false,
            pointsMultiplier: 1,
            ownerId,
          },
        })
      )
    )
    await prisma.derivedPermission.createMany({
      data: elements.map(({ id }) => ({
        userId: ownerId,
        elementId: id,
        permissionLevel: PermissionLevel.OWNER,
      })),
    })
    const target = elements.at(-1)!
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot(
      elements.map(({ id }) => id),
      barrier.ctx
    )
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.element.update({
        where: { id: target.id },
        data: {
          content: 'New content committed between export batches',
          version: { increment: 1 },
        },
      })
    } finally {
      barrier.resume.resolve()
    }

    const snapshot = await snapshotPromise
    expect(snapshot.elements.at(-1)?.content).toBe('Old batched content 21')
    await expect(
      loadElementExportSnapshot([target.id], ctx)
    ).resolves.toMatchObject({
      elements: [{ content: 'New content committed between export batches' }],
    })
  })

  it('rejects aggregate source bytes before materializing full element records', async () => {
    const maximumText = '\u0800'.repeat(MAX_IMPORT_EXPORT_CONTENT_LENGTH)
    await prisma.element.createMany({
      data: Array.from({ length: 9 }, (_, index) => ({
        name: `Aggregate source element ${index + 1}`,
        content: maximumText,
        explanation: maximumText,
        type: ElementType.SC,
        status: ElementStatus.READY,
        options: {
          displayMode: 'LIST',
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
          choices: [
            { ix: 0, value: 'A' },
            { ix: 1, value: 'B' },
          ],
        },
        basePoints: true,
        pointsMultiplier: 1,
        ownerId,
      })),
    })
    const oversizedElements = await prisma.element.findMany({
      where: {
        ownerId,
        name: { startsWith: 'Aggregate source element ' },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    await prisma.derivedPermission.createMany({
      data: oversizedElements.map(({ id }) => ({
        userId: ownerId,
        elementId: id,
        permissionLevel: PermissionLevel.OWNER,
      })),
    })
    expect(
      oversizedElements.length * Buffer.byteLength(maximumText, 'utf8') * 2
    ).toBeGreaterThan(MAX_IMPORT_EXPORT_PACKAGE_BYTES)
    const counter = withElementMaterializationCounter(ctx)

    await expect(
      loadElementExportSnapshot(
        oversizedElements.map(({ id }) => id),
        counter.ctx
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE,
    })
    expect(counter.observations()).toEqual({
      fullElementReads: 0,
      rawQueries: 1,
    })
  })
})
