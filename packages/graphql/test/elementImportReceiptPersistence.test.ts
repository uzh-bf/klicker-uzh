import { prisma } from '@klicker-uzh/prisma'
import {
  ElementImportReceiptState,
  ElementType,
  ImportExportPackageArtifactDirection,
  ImportExportPackageArtifactState,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { createImportExportArtifactStorageTarget } from '../src/lib/importExportCapabilities.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import {
  assertLiveElementImportReceiptLease,
  claimExpiredElementImportReceiptLease,
  claimExpiredPackageArtifactForCleanup,
  completeElementImportReceipt,
  createPendingElementImportReceipt,
  deleteExpiredPendingImportReceipt,
  findElementImportReceiptByJti,
  findExpiredCompletedImportReceiptsForCleanup,
  findExpiredPendingImportReceiptsForCleanup,
  isElementImportReceiptJtiUniqueConflict,
  pinReadyImportArtifactAndCreateReceipt,
} from '../src/services/importExportPersistence.js'

import {
  HASH_A,
  HASH_B,
  MINUTE_MS,
  atOffset,
  beginPersistenceTest,
  cleanupTestOwners,
  createArtifact,
  createMediaStaging,
  createPendingReceipt,
  expectDatabaseCheckFailure,
  ownerId,
  testNow,
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

  it('rejects COMPLETE receipts without a retention expiry', async () => {
    const artifact = await createArtifact()

    await expectDatabaseCheckFailure(
      prisma.elementImportReceipt.create({
        data: {
          jti: randomUUID(),
          sourceArtifactId: artifact.id,
          artifactRecordId: artifact.id,
          packageHash: HASH_A,
          selectionDigest: HASH_B,
          selectedElementRefs: ['element-one'],
          state: ElementImportReceiptState.COMPLETE,
          leaseId: null,
          leaseExpiresAt: null,
          createdElementIds: [101],
          createdAnswerCollectionIds: [],
          completedAt: testNow,
          retentionExpiresAt: null,
          ownerId,
        },
      })
    )
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

  it('enforces globally unique receipt JTIs', async () => {
    const firstArtifact = await createArtifact()
    const secondArtifact = await createArtifact()
    const jti = randomUUID()

    await createPendingReceipt({ artifactId: firstArtifact.id, jti })

    await expect(
      createPendingReceipt({ artifactId: secondArtifact.id, jti })
    ).rejects.toMatchObject({ code: 'P2002' })
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
})
