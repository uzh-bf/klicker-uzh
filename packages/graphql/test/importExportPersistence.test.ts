import { prisma } from '@klicker-uzh/prisma'
import {
  ElementImportReceiptState,
  ElementType,
  ImportExportPackageArtifactDirection,
  ImportExportPackageArtifactState,
  ImportMediaStagingState,
} from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { createImportExportArtifactStorageTarget } from '../src/lib/importExportCapabilities.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import {
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS,
} from '../src/lib/importExportPackageConfig.js'
import {
  assertLiveElementImportReceiptLease,
  claimExpiredElementImportReceiptLease,
  claimExpiredPackageArtifactForCleanup,
  claimImportExportPackageArtifact,
  completeElementImportReceipt,
  completeImportExportPackageArtifact,
  createPendingElementImportReceipt,
  deleteExpiredPendingImportReceipt,
  failImportExportPackageArtifact,
  findElementImportReceiptByJti,
  findExpiredCompletedImportReceiptsForCleanup,
  findExpiredImportMediaStagingForCleanup,
  findExpiredPackageArtifactsForCleanup,
  findExpiredPendingImportReceiptsForCleanup,
  isElementImportReceiptJtiUniqueConflict,
  markImportExportPackageArtifactStorageUncertain,
  pinReadyImportArtifactAndCreateReceipt,
  reserveImportExportPackageArtifact,
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
  assertExpectedImportExportPersistenceIndexes,
  atOffset,
  beginPersistenceTest,
  cleanupTestOwners,
  createArtifact,
  createMediaStaging,
  createPendingReceipt,
  createTestOwner,
  expectDatabaseCheckFailure,
  ownerId,
  testNow,
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

  it('creates and resolves an exact pending receipt identity by jti', async () => {
    const artifact = await createArtifact()
    const jti = randomUUID()
    const leaseId = randomUUID()
    const leaseExpiresAt = atOffset(10 * MINUTE_MS)
    const selectedElementRefs = ['element-one', 'element-two']

    await expect(
      createPendingElementImportReceipt({
        prisma,
        jti,
        sourceArtifactId: artifact.id,
        artifactRecordId: artifact.id,
        packageHash: HASH_A,
        selectionDigest: HASH_B,
        selectedElementRefs,
        leaseId,
        leaseExpiresAt,
        ownerId,
        now: testNow,
      })
    ).resolves.toMatchObject({
      jti,
      sourceArtifactId: artifact.id,
      artifactRecordId: artifact.id,
      packageHash: HASH_A,
      selectionDigest: HASH_B,
      selectedElementRefs,
      state: ElementImportReceiptState.PENDING,
      leaseId,
      leaseExpiresAt,
      createdElementIds: [],
      createdAnswerCollectionIds: [],
      ownerId,
    })

    await expect(
      findElementImportReceiptByJti({ prisma, jti })
    ).resolves.toMatchObject({
      jti,
      sourceArtifactId: artifact.id,
      artifactRecordId: artifact.id,
      packageHash: HASH_A,
      selectionDigest: HASH_B,
      selectedElementRefs,
      state: ElementImportReceiptState.PENDING,
      leaseId,
      ownerId,
    })
  })

  it('rejects malformed pending receipt identity before writing', async () => {
    const artifact = await createArtifact()
    const validInput = {
      prisma,
      jti: randomUUID(),
      sourceArtifactId: artifact.id,
      artifactRecordId: artifact.id,
      packageHash: HASH_A,
      selectionDigest: HASH_B,
      selectedElementRefs: ['element-one'],
      leaseId: randomUUID(),
      leaseExpiresAt: atOffset(10 * MINUTE_MS),
      ownerId,
      now: testNow,
    }

    await expect(
      createPendingElementImportReceipt({
        ...validInput,
        packageHash: 'not-a-hash',
      })
    ).rejects.toThrow(TypeError)
    await expect(
      createPendingElementImportReceipt({
        ...validInput,
        selectedElementRefs: ['element-one', 'element-one'],
      })
    ).rejects.toThrow(TypeError)
    await expect(
      createPendingElementImportReceipt({
        ...validInput,
        artifactRecordId: randomUUID(),
      })
    ).rejects.toThrow(TypeError)
    await expect(
      prisma.elementImportReceipt.count({ where: { ownerId } })
    ).resolves.toBe(0)
  })

  it('identifies only a jti uniqueness race for receipt creation', async () => {
    const artifact = await createArtifact()
    const jti = randomUUID()
    const createReceipt = () =>
      createPendingElementImportReceipt({
        prisma,
        jti,
        sourceArtifactId: artifact.id,
        artifactRecordId: artifact.id,
        packageHash: HASH_A,
        selectionDigest: HASH_B,
        selectedElementRefs: ['element-one'],
        leaseId: randomUUID(),
        leaseExpiresAt: atOffset(10 * MINUTE_MS),
        ownerId,
        now: testNow,
      })

    await createReceipt()
    const duplicateError = await createReceipt().then(
      () => null,
      (error: unknown) => error
    )

    expect(isElementImportReceiptJtiUniqueConflict(duplicateError)).toBe(true)
    expect(
      isElementImportReceiptJtiUniqueConflict({
        code: 'P2002',
        meta: { target: ['sourceArtifactId'] },
      })
    ).toBe(false)
    expect(isElementImportReceiptJtiUniqueConflict(new Error('P2002'))).toBe(
      false
    )
  })

  it('serializes first receipt pinning with artifact cleanup claiming', async () => {
    const artifactId = randomUUID()
    const target = createImportExportArtifactStorageTarget({
      direction: 'IMPORT',
      ownerId,
      artifactId,
    })
    const expiresAt = atOffset(MINUTE_MS)
    await prisma.importExportPackageArtifact.create({
      data: {
        id: artifactId,
        ownerId,
        direction: ImportExportPackageArtifactDirection.IMPORT,
        state: ImportExportPackageArtifactState.READY,
        storageContainer: target.storageContainer,
        storageBlob: target.storageBlob,
        reservedBytes: 1,
        bytes: 1,
        sha256: HASH_A,
        completedAt: testNow,
        expiresAt,
      },
    })

    const [pin, cleanupClaim] = await Promise.allSettled([
      pinReadyImportArtifactAndCreateReceipt({
        prisma,
        artifactId,
        jti: randomUUID(),
        packageHash: HASH_A,
        selectionDigest: HASH_B,
        selectedElementRefs: ['element-one'],
        leaseId: randomUUID(),
        leaseExpiresAt: atOffset(5 * MINUTE_MS),
        ownerId,
        now: new Date(expiresAt.getTime() - 1),
      }),
      claimExpiredPackageArtifactForCleanup({
        prisma,
        artifactId,
        now: new Date(expiresAt.getTime() + 1),
      }),
    ])

    const receiptCount = await prisma.elementImportReceipt.count({
      where: { artifactRecordId: artifactId },
    })
    const artifact = await prisma.importExportPackageArtifact.findUniqueOrThrow(
      { where: { id: artifactId } }
    )

    if (pin.status === 'fulfilled') {
      expect(receiptCount).toBe(1)
      expect(cleanupClaim).toMatchObject({
        status: 'fulfilled',
        value: null,
      })
      expect(artifact.state).toBe(ImportExportPackageArtifactState.READY)
    } else {
      expect(pin.reason).toMatchObject({
        code: ImportExportErrorCode.PACKAGE_NOT_FOUND,
      })
      expect(receiptCount).toBe(0)
      expect(cleanupClaim).toMatchObject({
        status: 'fulfilled',
        value: expect.objectContaining({ id: artifactId }),
      })
      expect(artifact.state).toBe(ImportExportPackageArtifactState.FAILED)
    }
  })

  it('locks only the live owned receipt lease inside a transaction', async () => {
    const artifact = await createArtifact()
    const leaseId = randomUUID()
    const leaseExpiresAt = atOffset(10 * MINUTE_MS)
    const receipt = await createPendingReceipt({
      artifactId: artifact.id,
      leaseId,
      leaseExpiresAt,
    })

    await prisma.$transaction(async (tx) => {
      await expect(
        assertLiveElementImportReceiptLease({
          prisma: tx,
          receiptId: receipt.id,
          ownerId,
          leaseId,
          now: testNow,
        })
      ).resolves.toEqual({ id: receipt.id })
      await expect(
        assertLiveElementImportReceiptLease({
          prisma: tx,
          receiptId: receipt.id,
          ownerId,
          leaseId: randomUUID(),
          now: testNow,
        })
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
      })
      await expect(
        assertLiveElementImportReceiptLease({
          prisma: tx,
          receiptId: receipt.id,
          ownerId,
          leaseId,
          now: leaseExpiresAt,
        })
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
      })
    })
  })

  it('returns immutable completed receipt replay data after artifact expiry', async () => {
    const artifact = await createArtifact()
    const jti = randomUUID()
    const leaseId = randomUUID()
    const receipt = await createPendingElementImportReceipt({
      prisma,
      jti,
      sourceArtifactId: artifact.id,
      artifactRecordId: artifact.id,
      packageHash: HASH_A,
      selectionDigest: HASH_B,
      selectedElementRefs: ['element-one'],
      leaseId,
      leaseExpiresAt: atOffset(10 * MINUTE_MS),
      ownerId,
      now: testNow,
    })
    const completedAt = atOffset(MINUTE_MS)
    const retentionExpiresAt = atOffset(30 * MINUTE_MS)

    await completeElementImportReceipt({
      prisma,
      receiptId: receipt.id,
      leaseId,
      createdElementIds: [101, 202],
      createdAnswerCollectionIds: [303],
      completedAt,
      retentionExpiresAt,
    })
    await expectDatabaseCheckFailure(
      prisma.elementImportReceipt.update({
        where: { id: receipt.id },
        data: {
          selectionDigest: HASH_A,
          selectedElementRefs: ['different-element'],
        },
      })
    )
    await expectDatabaseCheckFailure(
      prisma.elementImportReceipt.update({
        where: { id: receipt.id },
        data: {
          createdElementIds: [999],
          createdAnswerCollectionIds: [],
          retentionExpiresAt: atOffset(60 * MINUTE_MS),
        },
      })
    )
    await prisma.importExportPackageArtifact.delete({
      where: { id: artifact.id },
    })

    await expect(
      findElementImportReceiptByJti({ prisma, jti })
    ).resolves.toMatchObject({
      state: ElementImportReceiptState.COMPLETE,
      sourceArtifactId: artifact.id,
      artifactRecordId: null,
      packageHash: HASH_A,
      selectionDigest: HASH_B,
      selectedElementRefs: ['element-one'],
      createdElementIds: [101, 202],
      createdAnswerCollectionIds: [303],
      completedAt,
      retentionExpiresAt,
      ownerId,
    })
  })

  it('serializes concurrent artifact quota reservations per owner', async () => {
    const reservations = await Promise.allSettled(
      Array.from(
        { length: MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS + 1 },
        (_, index) =>
          reserveImportExportPackageArtifact({
            prisma,
            ownerId,
            direction: ImportExportPackageArtifactDirection.IMPORT,
            storageContainer: `quota-${TEST_RUN_ID}-${testSequence}`,
            storageBlob: `${index}.zip`,
            reservedBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
            expiresAt: atOffset(10 * MINUTE_MS),
            now: testNow,
          })
      )
    )

    const fulfilled = reservations.filter(
      (result) => result.status === 'fulfilled'
    )
    const rejected = reservations.filter(
      (result) => result.status === 'rejected'
    )

    expect(fulfilled).toHaveLength(MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({
      reason: { code: ImportExportErrorCode.ARTIFACT_QUOTA_EXCEEDED },
    })
    await expect(
      prisma.importExportPackageArtifact.count({ where: { ownerId } })
    ).resolves.toBe(MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS)

    const otherOwner = await createTestOwner('independent-quota')
    await expect(
      reserveImportExportPackageArtifact({
        prisma,
        ownerId: otherOwner.id,
        direction: ImportExportPackageArtifactDirection.EXPORT,
        storageContainer: `quota-${TEST_RUN_ID}-${testSequence}`,
        storageBlob: 'other-owner.zip',
        reservedBytes: 1,
        expiresAt: atOffset(10 * MINUTE_MS),
        now: testNow,
      })
    ).resolves.toMatchObject({ ownerId: otherOwner.id })
  })

  it('claims artifacts once and conditionally completes or fails them', async () => {
    const artifact = await createArtifact()

    const claims = await Promise.all([
      claimImportExportPackageArtifact({
        prisma,
        artifactId: artifact.id,
        ownerId,
        direction: ImportExportPackageArtifactDirection.IMPORT,
        now: testNow,
      }),
      claimImportExportPackageArtifact({
        prisma,
        artifactId: artifact.id,
        ownerId,
        direction: ImportExportPackageArtifactDirection.IMPORT,
        now: testNow,
      }),
    ])
    expect(claims.filter(Boolean)).toHaveLength(1)

    await expect(
      completeImportExportPackageArtifact({
        prisma,
        artifactId: artifact.id,
        ownerId,
        bytes: artifact.reservedBytes,
        sha256: HASH_A,
        completedAt: testNow,
      })
    ).resolves.toBe(true)
    await expect(
      completeImportExportPackageArtifact({
        prisma,
        artifactId: artifact.id,
        ownerId,
        bytes: artifact.reservedBytes,
        sha256: HASH_A,
        completedAt: testNow,
      })
    ).resolves.toBe(false)
    await expect(
      failImportExportPackageArtifact({
        prisma,
        artifactId: artifact.id,
        ownerId,
      })
    ).resolves.toBe(false)

    const failedArtifact = await createArtifact()
    await expect(
      failImportExportPackageArtifact({
        prisma,
        artifactId: failedArtifact.id,
        ownerId,
      })
    ).resolves.toBe(true)
    await expect(
      prisma.importExportPackageArtifact.findUniqueOrThrow({
        where: { id: failedArtifact.id },
        select: {
          state: true,
          reservedBytes: true,
          bytes: true,
          sha256: true,
          completedAt: true,
        },
      })
    ).resolves.toEqual({
      state: 'FAILED',
      reservedBytes: 0,
      bytes: null,
      sha256: null,
      completedAt: null,
    })
  })

  it('retains failed cleanup ledgers in count quota while releasing their byte quota', async () => {
    const failedArtifacts = await Promise.all(
      Array.from({ length: MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS - 1 }, () =>
        createArtifact()
      )
    )
    await Promise.all(
      failedArtifacts.map((artifact) =>
        failImportExportPackageArtifact({
          prisma,
          artifactId: artifact.id,
          ownerId,
        })
      )
    )

    const replacement = await reserveImportExportPackageArtifact({
      prisma,
      ownerId,
      direction: ImportExportPackageArtifactDirection.IMPORT,
      storageContainer: `failed-quota-${TEST_RUN_ID}-${testSequence}`,
      storageBlob: 'replacement.zip',
      reservedBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
      expiresAt: atOffset(10 * MINUTE_MS),
      now: testNow,
    })
    expect(replacement).toMatchObject({ ownerId })

    await expect(
      reserveImportExportPackageArtifact({
        prisma,
        ownerId,
        direction: ImportExportPackageArtifactDirection.IMPORT,
        storageContainer: `failed-count-${TEST_RUN_ID}-${testSequence}`,
        storageBlob: 'blocked.zip',
        reservedBytes: 1,
        expiresAt: atOffset(10 * MINUTE_MS),
        now: testNow,
      })
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.ARTIFACT_QUOTA_EXCEEDED,
    })
  })

  it('retains byte quota and the exact ledger for an indeterminate provider write', async () => {
    const artifact = await createArtifact()
    await expect(
      claimImportExportPackageArtifact({
        prisma,
        artifactId: artifact.id,
        ownerId,
        direction: ImportExportPackageArtifactDirection.IMPORT,
        now: testNow,
      })
    ).resolves.toBe(true)

    await expect(
      markImportExportPackageArtifactStorageUncertain({
        prisma,
        artifactId: artifact.id,
        ownerId,
      })
    ).resolves.toBe(true)
    await expect(
      prisma.importExportPackageArtifact.findUniqueOrThrow({
        where: { id: artifact.id },
        select: {
          state: true,
          reservedBytes: true,
          storageContainer: true,
          storageBlob: true,
        },
      })
    ).resolves.toEqual({
      state: ImportExportPackageArtifactState.UPLOADING,
      reservedBytes: artifact.reservedBytes,
      storageContainer: artifact.storageContainer,
      storageBlob: artifact.storageBlob,
    })
  })

  it('enforces globally unique receipt JTIs', async () => {
    const firstArtifact = await createArtifact()
    const secondArtifact = await createArtifact()
    const jti = randomUUID()

    await createPendingReceipt({ artifactId: firstArtifact.id, jti })

    await expect(
      createPendingReceipt({ artifactId: secondArtifact.id, jti })
    ).rejects.toMatchObject({ code: 'P2002' })
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

  it('allows exactly one expired-lease claimant and only that lease to complete', async () => {
    const artifact = await createArtifact()
    const receipt = await createPendingReceipt({
      artifactId: artifact.id,
      leaseExpiresAt: atOffset(MINUTE_MS),
    })
    const claimNow = atOffset(2 * MINUTE_MS)
    const firstLeaseId = randomUUID()
    const secondLeaseId = randomUUID()
    const replacementLeaseExpiresAt = atOffset(10 * MINUTE_MS)

    const claims = await Promise.all([
      claimExpiredElementImportReceiptLease({
        prisma,
        receiptId: receipt.id,
        leaseId: firstLeaseId,
        leaseExpiresAt: replacementLeaseExpiresAt,
        now: claimNow,
      }),
      claimExpiredElementImportReceiptLease({
        prisma,
        receiptId: receipt.id,
        leaseId: secondLeaseId,
        leaseExpiresAt: replacementLeaseExpiresAt,
        now: claimNow,
      }),
    ])

    expect(claims.filter(Boolean)).toHaveLength(1)
    const winningLeaseId = claims[0] ? firstLeaseId : secondLeaseId
    const staleLeaseId = claims[0] ? secondLeaseId : firstLeaseId
    const completedAt = atOffset(3 * MINUTE_MS)
    const retentionExpiresAt = atOffset(30 * MINUTE_MS)

    await expect(
      completeElementImportReceipt({
        prisma,
        receiptId: receipt.id,
        leaseId: staleLeaseId,
        createdElementIds: [999],
        createdAnswerCollectionIds: [],
        completedAt,
        retentionExpiresAt,
      })
    ).resolves.toBe(false)

    await expect(
      completeElementImportReceipt({
        prisma,
        receiptId: receipt.id,
        leaseId: winningLeaseId,
        createdElementIds: [101, 202],
        createdAnswerCollectionIds: [303],
        completedAt,
        retentionExpiresAt,
      })
    ).resolves.toBe(true)

    const completed = await prisma.elementImportReceipt.findUniqueOrThrow({
      where: { id: receipt.id },
    })
    expect(completed).toMatchObject({
      state: ElementImportReceiptState.COMPLETE,
      leaseId: null,
      leaseExpiresAt: null,
      createdElementIds: [101, 202],
      createdAnswerCollectionIds: [303],
    })

    await expect(
      claimExpiredElementImportReceiptLease({
        prisma,
        receiptId: receipt.id,
        leaseId: randomUUID(),
        leaseExpiresAt: atOffset(50 * MINUTE_MS),
        now: atOffset(40 * MINUTE_MS),
      })
    ).resolves.toBe(false)
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

  it('completes a receipt through a transaction client and rolls back atomically', async () => {
    const artifact = await createArtifact()
    const leaseId = randomUUID()
    const receipt = await createPendingReceipt({
      artifactId: artifact.id,
      leaseId,
    })
    const completedAt = atOffset(MINUTE_MS)
    const retentionExpiresAt = atOffset(30 * MINUTE_MS)

    await expect(
      prisma.$transaction(async (tx) => {
        const element = await tx.element.create({
          data: {
            type: ElementType.CONTENT,
            name: 'Rolled back import',
            content: 'Content',
            options: {},
            ownerId,
          },
        })
        expect(
          await completeElementImportReceipt({
            prisma: tx,
            receiptId: receipt.id,
            leaseId,
            createdElementIds: [element.id],
            createdAnswerCollectionIds: [],
            completedAt,
            retentionExpiresAt,
          })
        ).toBe(true)
        throw new Error('intentional transaction rollback')
      })
    ).rejects.toThrow('intentional transaction rollback')

    await expect(
      prisma.element.count({ where: { ownerId, name: 'Rolled back import' } })
    ).resolves.toBe(0)
    await expect(
      prisma.elementImportReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        select: { state: true, leaseId: true },
      })
    ).resolves.toEqual({ state: ElementImportReceiptState.PENDING, leaseId })

    const committedElementId = await prisma.$transaction(async (tx) => {
      const element = await tx.element.create({
        data: {
          type: ElementType.CONTENT,
          name: 'Committed import',
          content: 'Content',
          options: {},
          ownerId,
        },
      })
      expect(
        await completeElementImportReceipt({
          prisma: tx,
          receiptId: receipt.id,
          leaseId,
          createdElementIds: [element.id],
          createdAnswerCollectionIds: [],
          completedAt,
          retentionExpiresAt,
        })
      ).toBe(true)
      return element.id
    })

    await expect(
      prisma.elementImportReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        select: { state: true, createdElementIds: true },
      })
    ).resolves.toEqual({
      state: ElementImportReceiptState.COMPLETE,
      createdElementIds: [committedElementId],
    })
  })

  it('preserves immutable source artifact identity when its record expires', async () => {
    const artifact = await createArtifact()
    const receipt = await createPendingReceipt({ artifactId: artifact.id })

    await prisma.importExportPackageArtifact.delete({
      where: { id: artifact.id },
    })

    await expect(
      prisma.elementImportReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        select: { sourceArtifactId: true, artifactRecordId: true },
      })
    ).resolves.toEqual({
      sourceArtifactId: artifact.id,
      artifactRecordId: null,
    })
  })

  it('finds and conditionally deletes only abandoned detached pending receipts', async () => {
    const queryNow = atOffset(2 * MINUTE_MS)

    const eligibleArtifact = await createArtifact()
    const eligible = await createPendingReceipt({
      artifactId: eligibleArtifact.id,
      leaseExpiresAt: atOffset(MINUTE_MS),
    })
    await prisma.importExportPackageArtifact.delete({
      where: { id: eligibleArtifact.id },
    })

    const linkedArtifact = await createArtifact()
    const linked = await createPendingReceipt({
      artifactId: linkedArtifact.id,
      leaseExpiresAt: atOffset(MINUTE_MS),
    })

    const activeArtifact = await createArtifact()
    const active = await createPendingReceipt({
      artifactId: activeArtifact.id,
      leaseExpiresAt: atOffset(3 * MINUTE_MS),
    })
    await prisma.importExportPackageArtifact.delete({
      where: { id: activeArtifact.id },
    })

    const stagedArtifact = await createArtifact()
    const staged = await createPendingReceipt({
      artifactId: stagedArtifact.id,
      leaseExpiresAt: atOffset(MINUTE_MS),
    })
    await createMediaStaging({ receiptId: staged.id })
    await prisma.importExportPackageArtifact.delete({
      where: { id: stagedArtifact.id },
    })

    const candidates = await findExpiredPendingImportReceiptsForCleanup({
      prisma,
      now: queryNow,
    })
    expect(candidates).toEqual([{ id: eligible.id }])

    await expect(
      deleteExpiredPendingImportReceipt({
        prisma,
        receiptId: linked.id,
        now: queryNow,
      })
    ).resolves.toBe(false)
    await expect(
      deleteExpiredPendingImportReceipt({
        prisma,
        receiptId: active.id,
        now: queryNow,
      })
    ).resolves.toBe(false)
    await expect(
      deleteExpiredPendingImportReceipt({
        prisma,
        receiptId: staged.id,
        now: queryNow,
      })
    ).resolves.toBe(false)
    await expect(
      deleteExpiredPendingImportReceipt({
        prisma,
        receiptId: eligible.id,
        now: queryNow,
      })
    ).resolves.toBe(true)
    await expect(
      prisma.elementImportReceipt.findUnique({ where: { id: eligible.id } })
    ).resolves.toBeNull()
  })

  it('finds expired artifacts without selecting records protected by active leases', async () => {
    const queryNow = atOffset(2 * MINUTE_MS)
    const unreferenced = await createArtifact({
      expiresAt: atOffset(MINUTE_MS),
    })
    const expiredLeaseArtifact = await createArtifact({
      expiresAt: atOffset(MINUTE_MS),
    })
    await createPendingReceipt({
      artifactId: expiredLeaseArtifact.id,
      leaseExpiresAt: atOffset(MINUTE_MS),
    })
    const activeLeaseArtifact = await createArtifact({
      expiresAt: atOffset(MINUTE_MS),
    })
    await createPendingReceipt({
      artifactId: activeLeaseArtifact.id,
      leaseExpiresAt: atOffset(3 * MINUTE_MS),
    })
    const unexpired = await createArtifact({
      expiresAt: atOffset(3 * MINUTE_MS),
    })

    const candidates = await findExpiredPackageArtifactsForCleanup({
      prisma,
      now: queryNow,
    })
    const candidateIds = candidates.map(({ id }) => id)

    expect(candidateIds).toEqual(
      expect.arrayContaining([unreferenced.id, expiredLeaseArtifact.id])
    )
    expect(candidateIds).not.toContain(activeLeaseArtifact.id)
    expect(candidateIds).not.toContain(unexpired.id)
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

  it('finds retained completed receipts only after retention expires', async () => {
    const artifact = await createArtifact()
    const leaseId = randomUUID()
    const receipt = await createPendingReceipt({
      artifactId: artifact.id,
      leaseId,
    })
    const completedAt = atOffset(MINUTE_MS)
    const retentionExpiresAt = atOffset(2 * MINUTE_MS)
    await completeElementImportReceipt({
      prisma,
      receiptId: receipt.id,
      leaseId,
      createdElementIds: [123],
      createdAnswerCollectionIds: [],
      completedAt,
      retentionExpiresAt,
    })

    await expect(
      findExpiredCompletedImportReceiptsForCleanup({
        prisma,
        now: atOffset(MINUTE_MS),
      })
    ).resolves.toEqual([])
    await expect(
      findExpiredCompletedImportReceiptsForCleanup({
        prisma,
        now: atOffset(3 * MINUTE_MS),
      })
    ).resolves.toContainEqual({ id: receipt.id })
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

  it('enforces durable-state checks in PostgreSQL', async () => {
    await expectDatabaseCheckFailure(
      prisma.importExportPackageArtifact.create({
        data: {
          ownerId,
          direction: ImportExportPackageArtifactDirection.IMPORT,
          storageContainer: `checks-${TEST_RUN_ID}`,
          storageBlob: `${testSequence}/invalid-artifact.zip`,
          reservedBytes: 1,
          bytes: 1,
          expiresAt: atOffset(10 * MINUTE_MS),
        },
      })
    )

    const artifact = await createArtifact()
    await expectDatabaseCheckFailure(
      prisma.elementImportReceipt.create({
        data: {
          jti: randomUUID(),
          sourceArtifactId: artifact.id,
          artifactRecordId: artifact.id,
          packageHash: HASH_A,
          selectionDigest: HASH_B,
          selectedElementRefs: [],
          leaseId: randomUUID(),
          leaseExpiresAt: atOffset(10 * MINUTE_MS),
          createdElementIds: [],
          createdAnswerCollectionIds: [],
          ownerId,
        },
      })
    )

    const receipt = await createPendingReceipt({ artifactId: artifact.id })
    await expectDatabaseCheckFailure(
      prisma.importMediaStaging.create({
        data: {
          operationId: randomUUID(),
          receiptId: receipt.id,
          ownerId,
          packageMediaRef: 'media/invalid.png',
          contentHash: 'not-a-sha256',
          storageContainer: `checks-${TEST_RUN_ID}`,
          storageBlob: `${testSequence}/invalid-media.png`,
          expiresAt: atOffset(10 * MINUTE_MS),
        },
      })
    )

    await expectDatabaseCheckFailure(
      prisma.mediaFile.create({
        data: {
          href: `https://storage.invalid/${randomUUID()}.png`,
          name: 'Invalid hash',
          type: 'image/png',
          contentHash: 'not-a-sha256',
          ownerId,
        },
      })
    )

    await expectDatabaseCheckFailure(
      prisma.mediaFile.create({
        data: {
          href: `https://storage.invalid/${randomUUID()}.png`,
          name: 'Invalid media fingerprint version',
          type: 'image/png',
          importFingerprintVersion: 0,
          ownerId,
        },
      })
    )

    await expectDatabaseCheckFailure(
      prisma.element.create({
        data: {
          type: ElementType.CONTENT,
          name: 'Invalid fingerprint version',
          content: 'Content',
          options: {},
          importFingerprintVersion: 0,
          ownerId,
        },
      })
    )
  })

  it('installs the expected lookup, cleanup, and uniqueness indexes', async () => {
    await assertExpectedImportExportPersistenceIndexes()
  })

  it('keeps old-client-style writes valid when new nullable fields are omitted', async () => {
    const element = await prisma.element.create({
      data: {
        type: ElementType.CONTENT,
        name: 'Legacy element write',
        content: 'Content',
        options: {},
        ownerId,
      },
    })
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Legacy collection write',
        description: '',
        ownerId,
      },
    })
    const mediaFile = await prisma.mediaFile.create({
      data: {
        href: `https://storage.invalid/${randomUUID()}.png`,
        name: 'Legacy media write',
        type: 'image/png',
        ownerId,
      },
    })

    expect(element.importFingerprintVersion).toBeNull()
    expect(answerCollection.importFingerprintVersion).toBeNull()
    expect(mediaFile.contentHash).toBeNull()
  })
})
