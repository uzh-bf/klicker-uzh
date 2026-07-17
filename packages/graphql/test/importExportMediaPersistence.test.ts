import { prisma } from '@klicker-uzh/prisma'
import { ImportMediaStagingState } from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import {
  claimExpiredElementImportReceiptLease,
  findExpiredImportMediaStagingForCleanup,
} from '../src/services/importExportPersistence.js'
import {
  reconcileAbandonedImportMediaStaging,
  stageImportedMediaFile,
} from '../src/services/mediaStorage.js'

import {
  HASH_A,
  HASH_B,
  MINUTE_MS,
  TEST_RUN_ID,
  atOffset,
  beginPersistenceTest,
  cleanupTestOwners,
  createArtifact,
  createMediaStaging,
  createPendingReceipt,
  createTestOwner,
  expectDatabaseCheckFailure,
  ownerId,
  testSequence,
  waitForBlockedTransactionLock,
} from './importExportPersistenceTestSupport.js'

describe('import/export durable persistence', () => {
  beforeAll(cleanupTestOwners)

  beforeEach(beginPersistenceTest)

  afterEach(cleanupTestOwners)

  afterAll(async () => {
    await cleanupTestOwners()
    await prisma.$disconnect()
  })

  it('rejects cross-owner durable links and preserves media history on ownership transfer', async () => {
    const otherOwner = await createTestOwner('cross-owner')
    const artifact = await createArtifact()

    await expectDatabaseCheckFailure(
      createPendingReceipt({
        artifactId: artifact.id,
        receiptOwnerId: otherOwner.id,
      })
    )

    const receipt = await createPendingReceipt({ artifactId: artifact.id })
    await expectDatabaseCheckFailure(
      createMediaStaging({
        receiptId: receipt.id,
        stagingOwnerId: otherOwner.id,
      })
    )

    const otherMedia = await prisma.mediaFile.create({
      data: {
        href: `https://storage.invalid/${randomUUID()}.png`,
        name: 'Other owner media',
        type: 'image/png',
        contentHash: HASH_A,
        ownerId: otherOwner.id,
      },
    })
    await expectDatabaseCheckFailure(
      createMediaStaging({
        receiptId: receipt.id,
        state: ImportMediaStagingState.FINALIZED,
        createdBlob: true,
        mediaFileId: otherMedia.id,
      })
    )

    await expectDatabaseCheckFailure(
      prisma.importExportPackageArtifact.update({
        where: { id: artifact.id },
        data: { ownerId: otherOwner.id },
      })
    )
    await expectDatabaseCheckFailure(
      prisma.elementImportReceipt.update({
        where: { id: receipt.id },
        data: { ownerId: otherOwner.id },
      })
    )

    const ownerMedia = await prisma.mediaFile.create({
      data: {
        href: `https://storage.invalid/${randomUUID()}.png`,
        name: 'Transferable media',
        type: 'image/png',
        contentHash: HASH_A,
        ownerId,
      },
    })
    const staging = await createMediaStaging({
      receiptId: receipt.id,
      state: ImportMediaStagingState.FINALIZED,
      createdBlob: true,
      mediaFileId: ownerMedia.id,
    })

    await expectDatabaseCheckFailure(
      prisma.importMediaStaging.update({
        where: { id: staging.id },
        data: { ownerId: otherOwner.id },
      })
    )

    await prisma.mediaFile.update({
      where: { id: ownerMedia.id },
      data: { ownerId: otherOwner.id },
    })
    await expect(
      prisma.importMediaStaging.findUniqueOrThrow({
        where: { id: staging.id },
        select: { ownerId: true, mediaFileId: true },
      })
    ).resolves.toEqual({ ownerId, mediaFileId: null })
  })

  it('serializes staging links with concurrent media ownership transfers', async () => {
    const otherOwner = await createTestOwner('concurrent-media-transfer')
    const artifact = await createArtifact()
    const receipt = await createPendingReceipt({ artifactId: artifact.id })
    const mediaFile = await prisma.mediaFile.create({
      data: {
        href: `https://storage.invalid/${randomUUID()}.png`,
        name: 'Concurrently transferred media',
        type: 'image/png',
        contentHash: HASH_A,
        ownerId,
      },
    })

    let markTransferReady!: () => void
    let releaseTransfer!: () => void
    const transferReady = new Promise<void>((resolve) => {
      markTransferReady = resolve
    })
    const transferRelease = new Promise<void>((resolve) => {
      releaseTransfer = resolve
    })
    const transfer = prisma.$transaction(async (tx) => {
      await tx.mediaFile.update({
        where: { id: mediaFile.id },
        data: { ownerId: otherOwner.id },
      })
      markTransferReady()
      await transferRelease
    })

    await transferReady
    const stagingAttempt = createMediaStaging({
      receiptId: receipt.id,
      state: ImportMediaStagingState.FINALIZED,
      createdBlob: true,
      mediaFileId: mediaFile.id,
    }).then(
      () => ({ succeeded: true as const, error: undefined }),
      (error: unknown) => ({ succeeded: false as const, error })
    )

    try {
      await waitForBlockedTransactionLock()
    } finally {
      releaseTransfer()
    }
    await transfer

    const result = await stagingAttempt
    expect(result.succeeded).toBe(false)
    expect(String((result.error as { message?: unknown })?.message)).toMatch(
      /mismatch|constraint|violates/i
    )
    await expect(
      prisma.importMediaStaging.count({
        where: { mediaFileId: mediaFile.id },
      })
    ).resolves.toBe(0)
  })

  it('restricts owner and receipt deletion until exact cleanup records are removed', async () => {
    const artifact = await createArtifact()
    const receipt = await createPendingReceipt({ artifactId: artifact.id })
    const staging = await createMediaStaging({ receiptId: receipt.id })

    await expect(
      prisma.user.delete({ where: { id: ownerId } })
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(
      prisma.elementImportReceipt.delete({ where: { id: receipt.id } })
    ).rejects.toMatchObject({ code: 'P2003' })

    await expect(
      prisma.importMediaStaging.findUnique({ where: { id: staging.id } })
    ).resolves.not.toBeNull()
    await expect(
      prisma.importExportPackageArtifact.findUnique({
        where: { id: artifact.id },
      })
    ).resolves.not.toBeNull()

    await prisma.importMediaStaging.delete({ where: { id: staging.id } })
    await prisma.elementImportReceipt.delete({ where: { id: receipt.id } })
    await prisma.importExportPackageArtifact.delete({
      where: { id: artifact.id },
    })
    await expect(
      prisma.user.delete({ where: { id: ownerId } })
    ).resolves.toBeDefined()
  })

  it('prevents a stale lease from fencing media owned by its replacement', async () => {
    const artifact = await createArtifact()
    const oldLeaseId = randomUUID()
    const receipt = await createPendingReceipt({
      artifactId: artifact.id,
      leaseId: oldLeaseId,
      leaseExpiresAt: atOffset(MINUTE_MS),
    })
    const staging = await createMediaStaging({
      receiptId: receipt.id,
      operationId: oldLeaseId,
    })
    const newLeaseId = randomUUID()
    await expect(
      claimExpiredElementImportReceiptLease({
        prisma,
        receiptId: receipt.id,
        leaseId: newLeaseId,
        leaseExpiresAt: atOffset(10 * MINUTE_MS),
        now: atOffset(2 * MINUTE_MS),
      })
    ).resolves.toBe(true)

    await expect(
      reconcileAbandonedImportMediaStaging({
        prisma,
        receiptId: receipt.id,
        ownerId,
        operationId: oldLeaseId,
      })
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
    })
    const bytes = Buffer.from('stale lease media')
    await expect(
      stageImportedMediaFile(
        {
          buffer: bytes,
          contentType: 'image/png',
          filename: 'stale.png',
          originalId: `import-media:${HASH_A}`,
          contentHash: createHash('sha256').update(bytes).digest('hex'),
          durableOperation: {
            receiptId: receipt.id,
            operationId: oldLeaseId,
            packageMediaRef: 'stale-media',
            expiresAt: atOffset(10 * MINUTE_MS),
          },
        },
        { user: { sub: ownerId }, prisma } as any
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
    })
    await expect(
      prisma.importMediaStaging.findUniqueOrThrow({
        where: { id: staging.id },
      })
    ).resolves.toMatchObject({
      operationId: oldLeaseId,
      packageMediaRef: staging.packageMediaRef,
      state: ImportMediaStagingState.RESERVED,
    })

    await expect(
      reconcileAbandonedImportMediaStaging({
        prisma,
        receiptId: receipt.id,
        ownerId,
        operationId: newLeaseId,
      })
    ).resolves.toBeUndefined()
    await expect(
      prisma.importMediaStaging.findUniqueOrThrow({
        where: { id: staging.id },
      })
    ).resolves.toMatchObject({
      operationId: oldLeaseId,
      packageMediaRef: `orphan:${staging.id}`,
      state: ImportMediaStagingState.CLEANUP_PENDING,
    })
  })

  it('finds only non-finalized expired media staging records', async () => {
    const artifact = await createArtifact()
    const receipt = await createPendingReceipt({
      artifactId: artifact.id,
      leaseExpiresAt: atOffset(MINUTE_MS),
    })
    const expiredStates = [
      ImportMediaStagingState.RESERVED,
      ImportMediaStagingState.COPIED,
      ImportMediaStagingState.CLEANUP_PENDING,
    ] as const
    const expiredRecords = await Promise.all(
      expiredStates.map((state) =>
        createMediaStaging({
          receiptId: receipt.id,
          state,
          createdBlob: state === ImportMediaStagingState.COPIED,
          expiresAt: atOffset(MINUTE_MS),
        })
      )
    )
    const finalized = await createMediaStaging({
      receiptId: receipt.id,
      state: ImportMediaStagingState.FINALIZED,
      createdBlob: true,
      expiresAt: atOffset(MINUTE_MS),
    })
    const unexpired = await createMediaStaging({
      receiptId: receipt.id,
      expiresAt: atOffset(3 * MINUTE_MS),
    })
    const activeLeaseArtifact = await createArtifact()
    const activeLeaseReceipt = await createPendingReceipt({
      artifactId: activeLeaseArtifact.id,
      leaseExpiresAt: atOffset(3 * MINUTE_MS),
    })
    const activeLeaseStaging = await createMediaStaging({
      receiptId: activeLeaseReceipt.id,
      expiresAt: atOffset(MINUTE_MS),
    })

    const candidates = await findExpiredImportMediaStagingForCleanup({
      prisma,
      now: atOffset(2 * MINUTE_MS),
    })
    const candidateIds = candidates.map(({ id }) => id)

    expect(candidateIds).toEqual(
      expect.arrayContaining(expiredRecords.map(({ id }) => id))
    )
    expect(candidateIds).not.toContain(finalized.id)
    expect(candidateIds).not.toContain(unexpired.id)
    expect(candidateIds).not.toContain(activeLeaseStaging.id)
  })

  it('rejects duplicate artifact and staging storage identities', async () => {
    const storageContainer = `duplicates-${TEST_RUN_ID}-${testSequence}`
    const firstArtifact = await createArtifact({
      storageContainer,
      storageBlob: 'artifact.zip',
    })
    await expect(
      createArtifact({ storageContainer, storageBlob: 'artifact.zip' })
    ).rejects.toMatchObject({ code: 'P2002' })

    const secondArtifact = await createArtifact()
    const firstReceipt = await createPendingReceipt({
      artifactId: firstArtifact.id,
    })
    const secondReceipt = await createPendingReceipt({
      artifactId: secondArtifact.id,
    })
    const firstStaging = await createMediaStaging({
      receiptId: firstReceipt.id,
      packageMediaRef: 'media/first.png',
      storageContainer,
      storageBlob: 'media/shared.png',
    })

    await expect(
      createMediaStaging({
        receiptId: secondReceipt.id,
        packageMediaRef: 'media/second.png',
        storageContainer,
        storageBlob: 'media/shared.png',
      })
    ).rejects.toMatchObject({ code: 'P2002' })

    await expect(
      createMediaStaging({
        receiptId: firstReceipt.id,
        packageMediaRef: firstStaging.packageMediaRef,
        storageContainer,
        storageBlob: 'media/different.png',
      })
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('keeps package and media cleanup targets immutable', async () => {
    const artifact = await createArtifact()
    const receipt = await createPendingReceipt({ artifactId: artifact.id })
    const staging = await createMediaStaging({ receiptId: receipt.id })

    await expectDatabaseCheckFailure(
      prisma.importExportPackageArtifact.update({
        where: { id: artifact.id },
        data: { storageBlob: `changed/${randomUUID()}.zip` },
      })
    )
    await expectDatabaseCheckFailure(
      prisma.importMediaStaging.update({
        where: { id: staging.id },
        data: {
          contentHash: HASH_B,
          storageBlob: `changed/${randomUUID()}.png`,
        },
      })
    )
  })

  it('keeps finalized staging history when its media record is deleted', async () => {
    const artifact = await createArtifact()
    const receipt = await createPendingReceipt({ artifactId: artifact.id })
    const mediaFile = await prisma.mediaFile.create({
      data: {
        href: `https://storage.invalid/${randomUUID()}.png`,
        name: 'Imported media',
        type: 'image/png',
        contentHash: HASH_A,
        ownerId,
      },
    })
    const staging = await createMediaStaging({
      receiptId: receipt.id,
      state: ImportMediaStagingState.FINALIZED,
      createdBlob: true,
      mediaFileId: mediaFile.id,
    })

    await prisma.mediaFile.delete({ where: { id: mediaFile.id } })

    await expect(
      prisma.importMediaStaging.findUniqueOrThrow({
        where: { id: staging.id },
        select: { state: true, createdBlob: true, mediaFileId: true },
      })
    ).resolves.toEqual({
      state: ImportMediaStagingState.FINALIZED,
      createdBlob: true,
      mediaFileId: null,
    })
  })
})
