import {
  ElementImportReceiptState,
  ImportExportPackageArtifactDirection,
  ImportExportPackageArtifactState,
  ImportMediaStagingState,
  Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { isCanonicalImportExportArtifactStorageTarget } from '../lib/importExportCapabilities.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import {
  MAX_IMPORT_EXPORT_ELEMENTS,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACT_BYTES,
  MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS,
} from '../lib/importExportPackageConfig.js'

const DEFAULT_CLEANUP_BATCH_SIZE = 100
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PACKAGE_REF_PATTERN = /^[A-Za-z0-9_-]{1,120}$/
const RESERVED_PACKAGE_REFS = new Set(['__proto__', 'constructor', 'prototype'])

const elementImportReceiptReplaySelect = {
  id: true,
  jti: true,
  sourceArtifactId: true,
  artifactRecordId: true,
  packageHash: true,
  selectionDigest: true,
  selectedElementRefs: true,
  state: true,
  leaseId: true,
  leaseExpiresAt: true,
  createdElementIds: true,
  createdAnswerCollectionIds: true,
  completedAt: true,
  retentionExpiresAt: true,
  ownerId: true,
} satisfies Prisma.ElementImportReceiptSelect

type ElementImportReceiptPersistenceClient = Pick<
  PrismaClient,
  'elementImportReceipt'
>
type ElementImportReceiptLeasePersistenceClient = Pick<
  PrismaClient,
  '$queryRaw'
>
type PackageArtifactPersistenceClient = Pick<
  PrismaClient,
  'importExportPackageArtifact'
>

function assertPositiveBatchSize(batchSize: number) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new TypeError('Cleanup batch size must be a positive integer.')
  }
}

function assertUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a UUID.`)
  }
}

function assertSha256(value: string, label: string) {
  if (!SHA256_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256 digest.`)
  }
}

function assertSelectedElementRefs(selectedElementRefs: readonly string[]) {
  if (
    selectedElementRefs.length === 0 ||
    selectedElementRefs.length > MAX_IMPORT_EXPORT_ELEMENTS ||
    new Set(selectedElementRefs).size !== selectedElementRefs.length ||
    selectedElementRefs.some(
      (ref) =>
        !PACKAGE_REF_PATTERN.test(ref) ||
        RESERVED_PACKAGE_REFS.has(ref.toLowerCase())
    )
  ) {
    throw new TypeError(
      'Invalid selected element references for import receipt.'
    )
  }
}

export async function reserveImportExportPackageArtifact({
  prisma,
  artifactId,
  ownerId,
  direction,
  storageContainer,
  storageBlob,
  reservedBytes,
  expiresAt,
  now = new Date(),
}: {
  prisma: PrismaClient
  artifactId?: string
  ownerId: string
  direction: ImportExportPackageArtifactDirection
  storageContainer: string
  storageBlob: string
  reservedBytes: number
  expiresAt: Date
  now?: Date
}) {
  if (
    !storageContainer ||
    !storageBlob ||
    !Number.isInteger(reservedBytes) ||
    reservedBytes <= 0 ||
    reservedBytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES ||
    expiresAt <= now
  ) {
    throw new TypeError('Invalid import/export artifact reservation.')
  }

  return await prisma.$transaction(
    async (tx) => {
      // The owner row is a stable, existing lock target. Serializing quota
      // reservations per owner prevents concurrent requests from both
      // observing quota below the limit and overcommitting it.
      const owners = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "public"."User"
            WHERE "id" = ${ownerId}::uuid
            FOR UPDATE
          `

      if (owners.length !== 1) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.INFRASTRUCTURE_FAILURE
        )
      }

      const where = {
        ownerId,
        expiresAt: { gt: now },
      }
      const [artifactCount, reservedByteTotal] = await Promise.all([
        tx.importExportPackageArtifact.count({ where }),
        tx.importExportPackageArtifact.aggregate({
          where,
          _sum: { reservedBytes: true },
        }),
      ])

      if (
        artifactCount >= MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACTS ||
        (reservedByteTotal._sum.reservedBytes ?? 0) + reservedBytes >
          MAX_IMPORT_EXPORT_UNEXPIRED_ARTIFACT_BYTES
      ) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.ARTIFACT_QUOTA_EXCEEDED
        )
      }

      return await tx.importExportPackageArtifact.create({
        data: {
          id: artifactId,
          ownerId,
          direction,
          storageContainer,
          storageBlob,
          reservedBytes,
          expiresAt,
        },
      })
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 10_000,
    }
  )
}

export async function claimImportExportPackageArtifact({
  prisma,
  artifactId,
  ownerId,
  direction,
  now = new Date(),
}: {
  prisma: PackageArtifactPersistenceClient
  artifactId: string
  ownerId: string
  direction: ImportExportPackageArtifactDirection
  now?: Date
}) {
  const result = await prisma.importExportPackageArtifact.updateMany({
    where: {
      id: artifactId,
      ownerId,
      direction,
      state: ImportExportPackageArtifactState.PENDING,
      expiresAt: { gt: now },
    },
    data: { state: ImportExportPackageArtifactState.UPLOADING },
  })

  return result.count === 1
}

export async function shrinkPendingImportExportPackageArtifact({
  prisma,
  artifactId,
  ownerId,
  fromBytes,
  toBytes,
}: {
  prisma: PackageArtifactPersistenceClient
  artifactId: string
  ownerId: string
  fromBytes: number
  toBytes: number
}) {
  if (
    !Number.isInteger(fromBytes) ||
    !Number.isInteger(toBytes) ||
    fromBytes <= 0 ||
    fromBytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES ||
    toBytes <= 0 ||
    toBytes > fromBytes
  ) {
    throw new TypeError('Invalid import/export artifact reservation resize.')
  }

  const result = await prisma.importExportPackageArtifact.updateMany({
    where: {
      id: artifactId,
      ownerId,
      state: ImportExportPackageArtifactState.PENDING,
      reservedBytes: fromBytes,
    },
    data: { reservedBytes: toBytes },
  })

  return result.count === 1
}

export async function completeImportExportPackageArtifact({
  prisma,
  artifactId,
  ownerId,
  bytes,
  sha256,
  completedAt = new Date(),
}: {
  prisma: PackageArtifactPersistenceClient
  artifactId: string
  ownerId: string
  bytes: number
  sha256: string
  completedAt?: Date
}) {
  if (
    !Number.isInteger(bytes) ||
    bytes <= 0 ||
    bytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES ||
    !/^[a-f0-9]{64}$/.test(sha256)
  ) {
    throw new TypeError('Invalid completed import/export artifact state.')
  }

  const result = await prisma.importExportPackageArtifact.updateMany({
    where: {
      id: artifactId,
      ownerId,
      state: ImportExportPackageArtifactState.UPLOADING,
      reservedBytes: bytes,
      expiresAt: { gt: completedAt },
    },
    data: {
      state: ImportExportPackageArtifactState.READY,
      bytes,
      sha256,
      completedAt,
    },
  })

  return result.count === 1
}

export async function failImportExportPackageArtifact({
  prisma,
  artifactId,
  ownerId,
}: {
  prisma: PackageArtifactPersistenceClient
  artifactId: string
  ownerId: string
}) {
  const result = await prisma.importExportPackageArtifact.updateMany({
    where: {
      id: artifactId,
      ownerId,
      state: {
        in: [
          ImportExportPackageArtifactState.PENDING,
          ImportExportPackageArtifactState.UPLOADING,
        ],
      },
    },
    data: {
      state: ImportExportPackageArtifactState.FAILED,
      reservedBytes: 0,
      bytes: null,
      sha256: null,
      completedAt: null,
    },
  })

  return result.count === 1
}

/**
 * Retains an indeterminate provider write without releasing its quota or
 * deleting its exact cleanup target. UPLOADING is intentionally preserved:
 * the blob may have been accepted after the caller's deadline, so only
 * expiry-driven cleanup may safely release the ledger and reservation.
 */
export async function markImportExportPackageArtifactStorageUncertain({
  prisma,
  artifactId,
  ownerId,
}: {
  prisma: PackageArtifactPersistenceClient
  artifactId: string
  ownerId: string
}) {
  const result = await prisma.importExportPackageArtifact.updateMany({
    where: {
      id: artifactId,
      ownerId,
      state: ImportExportPackageArtifactState.UPLOADING,
    },
    data: { state: ImportExportPackageArtifactState.UPLOADING },
  })

  return result.count === 1
}

export async function findElementImportReceiptByJti({
  prisma,
  jti,
}: {
  prisma: ElementImportReceiptPersistenceClient
  jti: string
}) {
  assertUuid(jti, 'Import receipt jti')

  return await prisma.elementImportReceipt.findUnique({
    where: { jti },
    select: elementImportReceiptReplaySelect,
  })
}

export async function createPendingElementImportReceipt({
  prisma,
  jti,
  sourceArtifactId,
  artifactRecordId,
  packageHash,
  selectionDigest,
  selectedElementRefs,
  leaseId,
  leaseExpiresAt,
  ownerId,
  now = new Date(),
}: {
  prisma: ElementImportReceiptPersistenceClient
  jti: string
  sourceArtifactId: string
  artifactRecordId: string
  packageHash: string
  selectionDigest: string
  selectedElementRefs: readonly string[]
  leaseId: string
  leaseExpiresAt: Date
  ownerId: string
  now?: Date
}) {
  assertUuid(jti, 'Import receipt jti')
  assertUuid(sourceArtifactId, 'Import receipt source artifact id')
  assertUuid(artifactRecordId, 'Import receipt artifact record id')
  assertUuid(leaseId, 'Import receipt lease id')
  assertUuid(ownerId, 'Import receipt owner id')
  assertSha256(packageHash, 'Import receipt package hash')
  assertSha256(selectionDigest, 'Import receipt selection digest')
  assertSelectedElementRefs(selectedElementRefs)

  if (artifactRecordId !== sourceArtifactId || leaseExpiresAt <= now) {
    throw new TypeError('Invalid pending import receipt identity or lease.')
  }

  return await prisma.elementImportReceipt.create({
    data: {
      jti,
      sourceArtifactId,
      artifactRecordId,
      packageHash,
      selectionDigest,
      selectedElementRefs: [...selectedElementRefs],
      leaseId,
      leaseExpiresAt,
      createdElementIds: [],
      createdAnswerCollectionIds: [],
      ownerId,
    },
    select: elementImportReceiptReplaySelect,
  })
}

export async function pinReadyImportArtifactAndCreateReceipt({
  prisma,
  artifactId,
  jti,
  packageHash,
  selectionDigest,
  selectedElementRefs,
  leaseId,
  leaseExpiresAt,
  ownerId,
  now = new Date(),
}: {
  prisma: PrismaClient
  artifactId: string
  jti: string
  packageHash: string
  selectionDigest: string
  selectedElementRefs: readonly string[]
  leaseId: string
  leaseExpiresAt: Date
  ownerId: string
  now?: Date
}) {
  assertUuid(artifactId, 'Import artifact id')
  assertUuid(ownerId, 'Import receipt owner id')

  return await prisma.$transaction(
    async (tx) => {
      const artifacts = await tx.$queryRaw<
        Array<{
          id: string
          ownerId: string
          direction: ImportExportPackageArtifactDirection
          state: ImportExportPackageArtifactState
          storageContainer: string
          storageBlob: string
          bytes: number | null
          sha256: string | null
          expiresAt: Date
        }>
      >`
        SELECT
          "id",
          "ownerId",
          "direction",
          "state",
          "storageContainer",
          "storageBlob",
          "bytes",
          "sha256",
          "expiresAt"
        FROM "public"."ImportExportPackageArtifact"
        WHERE "id" = ${artifactId}::uuid
          AND "ownerId" = ${ownerId}::uuid
        FOR UPDATE
      `
      const artifact = artifacts[0]
      if (
        !artifact ||
        artifact.direction !== ImportExportPackageArtifactDirection.IMPORT ||
        artifact.state !== ImportExportPackageArtifactState.READY
      ) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.PACKAGE_NOT_FOUND
        )
      }
      if (artifact.expiresAt <= now) {
        throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_EXPIRED)
      }
      if (artifact.sha256 !== packageHash) {
        throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_CHANGED)
      }
      if (
        !artifact.bytes ||
        !isCanonicalImportExportArtifactStorageTarget({
          storageContainer: artifact.storageContainer,
          storageBlob: artifact.storageBlob,
          direction: artifact.direction,
          ownerId: artifact.ownerId,
          artifactId: artifact.id,
        })
      ) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.UNSAFE_REFERENCE
        )
      }

      return await createPendingElementImportReceipt({
        prisma: tx,
        jti,
        sourceArtifactId: artifactId,
        artifactRecordId: artifactId,
        packageHash,
        selectionDigest,
        selectedElementRefs,
        leaseId,
        leaseExpiresAt,
        ownerId,
        now,
      })
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 10_000,
    }
  )
}

export function isElementImportReceiptJtiUniqueConflict(error: unknown) {
  if (
    !error ||
    typeof error !== 'object' ||
    Reflect.get(error, 'code') !== 'P2002'
  ) {
    return false
  }

  const meta = Reflect.get(error, 'meta')
  if (!meta || typeof meta !== 'object') return false

  const modelName = Reflect.get(meta, 'modelName')
  if (modelName !== undefined && modelName !== 'ElementImportReceipt') {
    return false
  }

  const target = Reflect.get(meta, 'target')
  if (
    (Array.isArray(target) && target.length === 1 && target[0] === 'jti') ||
    target === 'ElementImportReceipt_jti_key'
  ) {
    return true
  }

  const driverAdapterError = Reflect.get(meta, 'driverAdapterError')
  if (!driverAdapterError || typeof driverAdapterError !== 'object')
    return false
  const cause = Reflect.get(driverAdapterError, 'cause')
  if (!cause || typeof cause !== 'object') return false
  const constraint = Reflect.get(cause, 'constraint')
  if (!constraint || typeof constraint !== 'object') return false
  const fields = Reflect.get(constraint, 'fields')

  return Array.isArray(fields) && fields.length === 1 && fields[0] === 'jti'
}

export async function assertLiveElementImportReceiptLease({
  prisma,
  receiptId,
  ownerId,
  leaseId,
  now = new Date(),
}: {
  prisma: Prisma.TransactionClient
  receiptId: string
  ownerId: string
  leaseId: string
  now?: Date
}) {
  assertUuid(receiptId, 'Import receipt id')
  assertUuid(ownerId, 'Import receipt owner id')
  assertUuid(leaseId, 'Import receipt lease id')

  const receipts = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."ElementImportReceipt"
    WHERE "id" = ${receiptId}::uuid
      AND "ownerId" = ${ownerId}::uuid
      AND "state" = 'PENDING'
      AND "leaseId" = ${leaseId}::uuid
      AND "leaseExpiresAt" > ${now}
    FOR UPDATE
  `

  if (receipts.length !== 1) {
    throw new ImportExportDomainError(ImportExportErrorCode.IMPORT_IN_PROGRESS)
  }

  return receipts[0]!
}

export async function claimExpiredElementImportReceiptLease({
  prisma,
  receiptId,
  leaseId,
  leaseExpiresAt,
  now = new Date(),
}: {
  prisma: ElementImportReceiptPersistenceClient
  receiptId: string
  leaseId: string
  leaseExpiresAt: Date
  now?: Date
}) {
  if (leaseExpiresAt <= now) {
    throw new TypeError(
      'The replacement import lease must expire in the future.'
    )
  }

  const result = await prisma.elementImportReceipt.updateMany({
    where: {
      id: receiptId,
      state: ElementImportReceiptState.PENDING,
      leaseExpiresAt: { lte: now },
    },
    data: { leaseId, leaseExpiresAt },
  })

  return result.count === 1
}

export async function renewElementImportReceiptLease({
  prisma,
  receiptId,
  ownerId,
  leaseId,
  leaseExpiresAt,
  now = new Date(),
}: {
  prisma: ElementImportReceiptLeasePersistenceClient
  receiptId: string
  ownerId: string
  leaseId: string
  leaseExpiresAt: Date
  now?: Date
}) {
  assertUuid(receiptId, 'Import receipt id')
  assertUuid(ownerId, 'Import receipt owner id')
  assertUuid(leaseId, 'Import receipt lease id')
  if (leaseExpiresAt <= now) {
    throw new TypeError('The renewed import lease must expire in the future.')
  }

  const renewed = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "public"."ElementImportReceipt"
    SET "leaseExpiresAt" = ${leaseExpiresAt}
    WHERE "id" = ${receiptId}::uuid
      AND "ownerId" = ${ownerId}::uuid
      AND "state" = 'PENDING'
      AND "leaseId" = ${leaseId}::uuid
      AND "leaseExpiresAt" > CURRENT_TIMESTAMP
      AND ${leaseExpiresAt} > CURRENT_TIMESTAMP
    RETURNING "id"
  `

  return renewed.length === 1
}

export async function completeElementImportReceipt({
  prisma,
  receiptId,
  leaseId,
  createdElementIds,
  createdAnswerCollectionIds,
  completedAt = new Date(),
  retentionExpiresAt,
}: {
  prisma: ElementImportReceiptPersistenceClient
  receiptId: string
  leaseId: string
  createdElementIds: number[]
  createdAnswerCollectionIds: number[]
  completedAt?: Date
  retentionExpiresAt: Date
}) {
  if (createdElementIds.length === 0 || retentionExpiresAt <= completedAt) {
    throw new TypeError('Invalid completed import receipt state.')
  }

  const result = await prisma.elementImportReceipt.updateMany({
    where: {
      id: receiptId,
      state: ElementImportReceiptState.PENDING,
      leaseId,
      leaseExpiresAt: { gt: completedAt },
    },
    data: {
      state: ElementImportReceiptState.COMPLETE,
      leaseId: null,
      leaseExpiresAt: null,
      createdElementIds,
      createdAnswerCollectionIds,
      completedAt,
      retentionExpiresAt,
    },
  })

  return result.count === 1
}

export async function findExpiredPackageArtifactsForCleanup({
  prisma,
  now = new Date(),
  batchSize = DEFAULT_CLEANUP_BATCH_SIZE,
  excludeIds = [],
}: {
  prisma: PrismaClient
  now?: Date
  batchSize?: number
  excludeIds?: string[]
}) {
  assertPositiveBatchSize(batchSize)

  return await prisma.importExportPackageArtifact.findMany({
    where: {
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      expiresAt: { lte: now },
      receipts: {
        none: {
          state: ElementImportReceiptState.PENDING,
          leaseExpiresAt: { gt: now },
        },
      },
    },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: {
      id: true,
      ownerId: true,
      direction: true,
      state: true,
      storageContainer: true,
      storageBlob: true,
      reservedBytes: true,
      expiresAt: true,
    },
  })
}

export async function claimExpiredPackageArtifactForCleanup({
  prisma,
  artifactId,
  now = new Date(),
}: {
  prisma: PrismaClient
  artifactId: string
  now?: Date
}) {
  assertUuid(artifactId, 'Import/export artifact id')

  return await prisma.$transaction(
    async (tx) => {
      const artifacts = await tx.$queryRaw<
        Array<{
          id: string
          ownerId: string
          direction: ImportExportPackageArtifactDirection
          storageContainer: string
          storageBlob: string
          expiresAt: Date
        }>
      >`
        SELECT
          "id",
          "ownerId",
          "direction",
          "storageContainer",
          "storageBlob",
          "expiresAt"
        FROM "public"."ImportExportPackageArtifact"
        WHERE "id" = ${artifactId}::uuid
        FOR UPDATE
      `
      const artifact = artifacts[0]
      if (!artifact || artifact.expiresAt > now) return null

      const activeReceipts = await tx.elementImportReceipt.count({
        where: {
          artifactRecordId: artifact.id,
          state: ElementImportReceiptState.PENDING,
          leaseExpiresAt: { gt: now },
        },
      })
      if (activeReceipts > 0) return null

      const claimed = await tx.importExportPackageArtifact.updateMany({
        where: { id: artifact.id, expiresAt: { lte: now } },
        data: {
          state: ImportExportPackageArtifactState.FAILED,
          reservedBytes: 0,
          bytes: null,
          sha256: null,
          completedAt: null,
        },
      })

      return claimed.count === 1 ? artifact : null
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 10_000,
    }
  )
}

export async function findExpiredImportMediaStagingForCleanup({
  prisma,
  now = new Date(),
  batchSize = DEFAULT_CLEANUP_BATCH_SIZE,
  excludeIds = [],
}: {
  prisma: PrismaClient
  now?: Date
  batchSize?: number
  excludeIds?: string[]
}) {
  assertPositiveBatchSize(batchSize)

  return await prisma.importMediaStaging.findMany({
    where: {
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      expiresAt: { lte: now },
      state: {
        in: [
          ImportMediaStagingState.RESERVED,
          ImportMediaStagingState.COPIED,
          ImportMediaStagingState.CLEANUP_PENDING,
        ],
      },
      receipt: {
        isNot: {
          state: ElementImportReceiptState.PENDING,
          leaseExpiresAt: { gt: now },
        },
      },
    },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: {
      id: true,
      ownerId: true,
      state: true,
      storageContainer: true,
      storageBlob: true,
      createdBlob: true,
      expiresAt: true,
    },
  })
}

export async function findExpiredPendingImportReceiptsForCleanup({
  prisma,
  now = new Date(),
  batchSize = DEFAULT_CLEANUP_BATCH_SIZE,
  excludeIds = [],
}: {
  prisma: PrismaClient
  now?: Date
  batchSize?: number
  excludeIds?: string[]
}) {
  assertPositiveBatchSize(batchSize)

  return await prisma.elementImportReceipt.findMany({
    where: {
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      state: ElementImportReceiptState.PENDING,
      artifactRecordId: null,
      leaseExpiresAt: { lte: now },
      mediaStaging: { none: {} },
    },
    orderBy: [{ leaseExpiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: { id: true },
  })
}

export async function deleteExpiredPendingImportReceipt({
  prisma,
  receiptId,
  now = new Date(),
}: {
  prisma: ElementImportReceiptPersistenceClient
  receiptId: string
  now?: Date
}) {
  assertUuid(receiptId, 'Import receipt id')

  const deleted = await prisma.elementImportReceipt.deleteMany({
    where: {
      id: receiptId,
      state: ElementImportReceiptState.PENDING,
      artifactRecordId: null,
      leaseExpiresAt: { lte: now },
      mediaStaging: { none: {} },
    },
  })

  return deleted.count === 1
}

export async function findExpiredCompletedImportReceiptsForCleanup({
  prisma,
  now = new Date(),
  batchSize = DEFAULT_CLEANUP_BATCH_SIZE,
  excludeIds = [],
}: {
  prisma: PrismaClient
  now?: Date
  batchSize?: number
  excludeIds?: string[]
}) {
  assertPositiveBatchSize(batchSize)

  return await prisma.elementImportReceipt.findMany({
    where: {
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      state: ElementImportReceiptState.COMPLETE,
      retentionExpiresAt: { lte: now },
      mediaStaging: {
        none: {
          state: {
            in: [
              ImportMediaStagingState.RESERVED,
              ImportMediaStagingState.COPIED,
              ImportMediaStagingState.CLEANUP_PENDING,
            ],
          },
        },
      },
    },
    orderBy: [{ retentionExpiresAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
    select: { id: true },
  })
}
