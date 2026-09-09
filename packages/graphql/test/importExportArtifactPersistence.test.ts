import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  ImportExportPackageArtifactDirection,
  ImportExportPackageArtifactState,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import {
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS,
} from '../src/lib/importExportPackageConfig.js'
import {
  claimImportExportPackageArtifact,
  completeImportExportPackageArtifact,
  failImportExportPackageArtifact,
  findExpiredPackageArtifactsForCleanup,
  markImportExportPackageArtifactStorageUncertain,
  reserveImportExportPackageArtifact,
} from '../src/services/importExportPersistence.js'

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
  createPendingReceipt,
  createTestOwner,
  expectDatabaseCheckFailure,
  ownerId,
  testNow,
  testSequence,
} from './importExportPersistenceTestSupport.js'

describe('import/export durable persistence', () => {
  beforeAll(cleanupTestOwners)

  beforeEach(beginPersistenceTest)

  afterEach(cleanupTestOwners)

  afterAll(async () => {
    await cleanupTestOwners()
    await prisma.$disconnect()
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

  it('rejects READY artifacts with missing byte or hash metadata', async () => {
    for (const [label, bytes, sha256] of [
      ['missing-bytes', null, HASH_A],
      ['missing-sha256', 1, null],
    ] as const) {
      await expectDatabaseCheckFailure(
        prisma.importExportPackageArtifact.create({
          data: {
            ownerId,
            direction: ImportExportPackageArtifactDirection.IMPORT,
            state: ImportExportPackageArtifactState.READY,
            storageContainer: `ready-checks-${TEST_RUN_ID}`,
            storageBlob: `${testSequence}/${label}.zip`,
            reservedBytes: 1,
            bytes,
            sha256,
            completedAt: testNow,
            expiresAt: atOffset(10 * MINUTE_MS),
          },
        })
      )
    }
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
