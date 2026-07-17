import {
  ImportExportPackageArtifactDirection,
  ImportExportPackageArtifactState,
  Prisma,
} from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'
import { createHash, randomUUID } from 'node:crypto'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  createImportExportArtifactStorageTarget,
  createImportUploadCapability,
  createLocalArtifactDownloadCapability,
  IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS,
  isCanonicalImportExportArtifactId,
  isCanonicalImportExportArtifactStorageTarget,
  verifyImportUploadCapability,
  verifyLocalArtifactDownloadCapability,
} from '../lib/importExportCapabilities.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_PACKAGE_BYTES } from '../lib/importExportPackageConfig.js'
import { getImportExportRuntimeConfig } from '../lib/importExportRuntimeConfig.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import { getImportExportTokenSecret } from '../lib/importExportTokenSecret.js'
import { assertCanUseElementImportExport } from './importExportAuthorization.js'
import { withImportExportConcurrencyLease } from './importExportConcurrency.js'
import {
  createPackageReadSasUrl,
  deletePackageArtifactBlobIfExists,
  isLocalImportExportPackageStorageEnabled,
  readPackageArtifactBlob,
  writePackageArtifactBlobExclusive,
} from './importExportPackageBlobStore.js'
import {
  claimImportExportPackageArtifact,
  completeImportExportPackageArtifact,
  failImportExportPackageArtifact,
  markImportExportPackageArtifactStorageUncertain,
  reserveImportExportPackageArtifact,
  shrinkPendingImportExportPackageArtifact,
} from './importExportPersistence.js'
import { assertImportExportRateLimit } from './importExportRateLimit.js'
import { ImportExportStorageDeadlineError } from './importExportStorageDeadline.js'

const ZIP_CONTENT_TYPE = 'application/zip'
const LOCAL_PACKAGE_ROUTE = '/api/import-export-packages'
const EXPORT_PUBLICATION_ATTEMPTS = 3

type PackageStorageContext = Pick<
  ContextWithUser,
  'prisma' | 'redisExec' | 'user'
>

type PackageStorageTelemetrySpan = Readonly<{
  correlationId: string
  operation: 'download' | 'export' | 'upload'
  packageBytes: number
  startedAt: number
}>

function startPackageStorageTelemetry(
  operation: PackageStorageTelemetrySpan['operation'],
  packageBytes: number
) {
  const span = {
    correlationId: randomUUID(),
    operation,
    packageBytes,
    startedAt: Date.now(),
  } satisfies PackageStorageTelemetrySpan
  emitImportExportTelemetry({
    correlationId: span.correlationId,
    operation,
    outcome: 'started',
    code: 'PACKAGE_STORAGE_STARTED',
    packageBytes,
  })
  return span
}

function finishPackageStorageTelemetry(
  span: PackageStorageTelemetrySpan,
  outcome: 'failure' | 'replayed' | 'success' | 'timeout',
  code: string
) {
  emitImportExportTelemetry({
    correlationId: span.correlationId,
    operation: span.operation,
    outcome,
    code,
    packageBytes: span.packageBytes,
    durationMs: Math.max(0, Date.now() - span.startedAt),
  })
}

function finishPackageStorageFailure(
  span: PackageStorageTelemetrySpan,
  error: unknown
) {
  finishPackageStorageTelemetry(
    span,
    error instanceof ImportExportStorageDeadlineError ? 'timeout' : 'failure',
    error instanceof ImportExportStorageDeadlineError
      ? 'PACKAGE_STORAGE_TIMEOUT'
      : error instanceof ImportExportDomainError
        ? error.code
        : 'PACKAGE_STORAGE_FAILED'
  )
}

export {
  cleanupImportExportPackages,
  handleCleanupImportExportPackages,
} from './importExportCleanup.js'
export {
  assertImportExportPackageStorageConfig,
  checkImportExportPackageStorageReadiness,
  isLocalImportExportPackageStorageEnabled,
  readLocalImportExportPackageBlob,
  writeLocalImportExportPackageBlob,
} from './importExportPackageBlobStore.js'

function getArtifactUploadUrl(artifactId: string) {
  const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
  return `${apiOrigin.replace(/\/$/, '')}${LOCAL_PACKAGE_ROUTE}/${artifactId}/upload`
}

function getLocalArtifactDownloadUrl(artifactId: string, capability: string) {
  const apiOrigin = process.env.APP_ORIGIN_API ?? 'http://127.0.0.1:3000'
  return `${apiOrigin.replace(/\/$/, '')}${LOCAL_PACKAGE_ROUTE}/${artifactId}/download?capability=${encodeURIComponent(
    capability
  )}`
}

async function readUploadStreamExact(
  stream: AsyncIterable<Uint8Array>,
  expectedBytes: number
) {
  const uploaded = Buffer.alloc(expectedBytes)
  const hash = createHash('sha256')
  let totalBytes = 0

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    const nextTotalBytes = totalBytes + buffer.length

    if (
      nextTotalBytes > expectedBytes ||
      nextTotalBytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES
    ) {
      throw new ImportExportDomainError(ImportExportErrorCode.UPLOAD_TOO_LARGE)
    }

    hash.update(buffer)
    buffer.copy(uploaded, totalBytes)
    totalBytes = nextTotalBytes
  }

  if (totalBytes !== expectedBytes) {
    throw new ImportExportDomainError(ImportExportErrorCode.INVALID_PACKAGE)
  }

  return {
    buffer: uploaded,
    bytes: totalBytes,
    sha256: hash.digest('hex'),
  }
}

function getImportExportPackageTtlHours() {
  return getImportExportRuntimeConfig().packageTtlHours
}

function sanitizeFilename(filename: string) {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitized.endsWith('.zip')
    ? sanitized
    : `${sanitized || 'package'}.zip`
}

function isPackageNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const code = Reflect.get(error, 'code')
  const statusCode = Reflect.get(error, 'statusCode')
  return code === 'ENOENT' || code === 'BlobNotFound' || statusCode === 404
}

function toPackageDownloadError(error: unknown) {
  if (error instanceof ImportExportDomainError) return error

  return new ImportExportDomainError(
    isPackageNotFoundError(error)
      ? ImportExportErrorCode.PACKAGE_NOT_FOUND
      : ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
    error
  )
}

async function discardClaimedArtifactAfterFailure({
  artifactId,
  ownerId,
  storageBlob,
  operation,
  ctx,
}: {
  artifactId: string
  ownerId: string
  storageBlob: string
  operation: 'upload' | 'export'
  ctx: PackageStorageContext
}) {
  try {
    await deletePackageArtifactBlobIfExists(storageBlob)
  } catch {
    await markImportExportPackageArtifactStorageUncertain({
      prisma: ctx.prisma,
      artifactId,
      ownerId,
    }).catch(() => undefined)
    emitImportExportTelemetry({
      operation: 'storage',
      outcome: 'failure',
      code: `${operation.toUpperCase()}_STORAGE_CLEANUP_UNKNOWN`,
    })
    return
  }

  try {
    await ctx.prisma.importExportPackageArtifact.deleteMany({
      where: {
        id: artifactId,
        ownerId,
        state: {
          in: [
            ImportExportPackageArtifactState.UPLOADING,
            ImportExportPackageArtifactState.READY,
          ],
        },
      },
    })
  } catch {
    await markImportExportPackageArtifactStorageUncertain({
      prisma: ctx.prisma,
      artifactId,
      ownerId,
    }).catch(() => undefined)
    emitImportExportTelemetry({
      operation: 'storage',
      outcome: 'failure',
      code: `${operation.toUpperCase()}_LEDGER_CLEANUP_FAILED`,
    })
  }
}

async function retainUncertainArtifactAfterWriteFailure({
  artifactId,
  ownerId,
  operation,
  ctx,
}: {
  artifactId: string
  ownerId: string
  operation: 'upload' | 'export'
  ctx: PackageStorageContext
}) {
  await markImportExportPackageArtifactStorageUncertain({
    prisma: ctx.prisma,
    artifactId,
    ownerId,
  }).catch(() => undefined)
  emitImportExportTelemetry({
    operation: 'storage',
    outcome: 'failure',
    code: `${operation.toUpperCase()}_STORAGE_WRITE_UNKNOWN`,
  })
}

export async function prepareElementImportPackageUpload(
  { bytes }: { bytes: number },
  ctx: PackageStorageContext
) {
  const artifactId = randomUUID()
  const target = createImportExportArtifactStorageTarget({
    direction: 'IMPORT',
    ownerId: ctx.user.sub,
    artifactId,
  })
  const artifactExpiresAt = dayjs()
    .add(getImportExportPackageTtlHours(), 'hours')
    .toDate()
  await reserveImportExportPackageArtifact({
    prisma: ctx.prisma,
    artifactId,
    ownerId: ctx.user.sub,
    direction: ImportExportPackageArtifactDirection.IMPORT,
    storageContainer: target.storageContainer,
    storageBlob: target.storageBlob,
    reservedBytes: bytes,
    expiresAt: artifactExpiresAt,
  })

  const issuedAt = Date.now()
  const expiresAt = issuedAt + IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS
  const uploadCapability = createImportUploadCapability({
    secret: getImportExportTokenSecret(),
    userId: ctx.user.sub,
    artifactId,
    bytes,
    issuedAt,
    expiresAt,
  })

  return {
    artifactId,
    blobName: target.storageBlob,
    uploadURL: getArtifactUploadUrl(artifactId),
    uploadCapability,
    expiresAt: new Date(expiresAt),
  }
}

export async function uploadPreparedElementImportPackage(
  {
    artifactId,
    capability,
    contentLength,
    contentType,
    stream,
  }: {
    artifactId: string
    capability: string
    contentLength: number
    contentType: string
    stream: AsyncIterable<Uint8Array>
  },
  ctx: PackageStorageContext
) {
  await assertCanUseElementImportExport(ctx)

  if (!isCanonicalImportExportArtifactId(artifactId)) {
    throw new ImportExportDomainError(ImportExportErrorCode.TOKEN_INVALID)
  }

  if (contentType.trim().toLowerCase() !== ZIP_CONTENT_TYPE) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.UNSUPPORTED_FILE_TYPE
    )
  }
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_IMPORT_EXPORT_PACKAGE_BYTES
  ) {
    throw new ImportExportDomainError(
      contentLength > MAX_IMPORT_EXPORT_PACKAGE_BYTES
        ? ImportExportErrorCode.UPLOAD_TOO_LARGE
        : ImportExportErrorCode.INVALID_PACKAGE
    )
  }

  const now = new Date()
  const artifact = await ctx.prisma.importExportPackageArtifact.findFirst({
    where: {
      id: artifactId,
      ownerId: ctx.user.sub,
      direction: ImportExportPackageArtifactDirection.IMPORT,
    },
    select: {
      id: true,
      ownerId: true,
      direction: true,
      state: true,
      storageContainer: true,
      storageBlob: true,
      reservedBytes: true,
      bytes: true,
      sha256: true,
      expiresAt: true,
    },
  })

  if (!artifact) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_NOT_FOUND)
  }
  if (artifact.expiresAt <= now) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_EXPIRED)
  }
  if (
    artifact.reservedBytes !== contentLength ||
    !isCanonicalImportExportArtifactStorageTarget({
      storageContainer: artifact.storageContainer,
      storageBlob: artifact.storageBlob,
      direction: artifact.direction,
      ownerId: artifact.ownerId,
      artifactId: artifact.id,
    }) ||
    !verifyImportUploadCapability({
      token: capability,
      secret: getImportExportTokenSecret(),
      userId: ctx.user.sub,
      artifactId: artifact.id,
      bytes: artifact.reservedBytes,
    })
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.TOKEN_INVALID)
  }

  if (
    artifact.state === ImportExportPackageArtifactState.READY &&
    artifact.bytes === contentLength &&
    artifact.sha256
  ) {
    const telemetry = startPackageStorageTelemetry('upload', contentLength)
    finishPackageStorageTelemetry(
      telemetry,
      'replayed',
      'PACKAGE_UPLOAD_REPLAYED'
    )
    return { bytes: artifact.bytes, sha256: artifact.sha256, replayed: true }
  }
  if (artifact.state !== ImportExportPackageArtifactState.PENDING) {
    throw new ImportExportDomainError(ImportExportErrorCode.IMPORT_IN_PROGRESS)
  }

  await assertImportExportRateLimit(ctx, 'upload')
  return await withImportExportConcurrencyLease(
    ctx,
    'upload',
    async (assertLease) => {
      assertLease()
      const claimed = await claimImportExportPackageArtifact({
        prisma: ctx.prisma,
        artifactId: artifact.id,
        ownerId: ctx.user.sub,
        direction: ImportExportPackageArtifactDirection.IMPORT,
        now,
      })
      if (!claimed) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.IMPORT_IN_PROGRESS
        )
      }

      let storageWriteStarted = false
      let storageWriteCompleted = false
      const telemetry = startPackageStorageTelemetry('upload', contentLength)
      try {
        const uploaded = await readUploadStreamExact(stream, contentLength)
        assertLease()
        storageWriteStarted = true
        await writePackageArtifactBlobExclusive(
          artifact.storageBlob,
          uploaded.buffer
        )
        storageWriteCompleted = true
        assertLease()
        const completed = await completeImportExportPackageArtifact({
          prisma: ctx.prisma,
          artifactId: artifact.id,
          ownerId: ctx.user.sub,
          bytes: uploaded.bytes,
          sha256: uploaded.sha256,
        })
        if (!completed) {
          throw new ImportExportDomainError(
            ImportExportErrorCode.INFRASTRUCTURE_FAILURE
          )
        }

        finishPackageStorageTelemetry(
          telemetry,
          'success',
          'PACKAGE_UPLOAD_COMPLETED'
        )
        return {
          bytes: uploaded.bytes,
          sha256: uploaded.sha256,
          replayed: false,
        }
      } catch (error) {
        if (storageWriteStarted && !storageWriteCompleted) {
          await retainUncertainArtifactAfterWriteFailure({
            artifactId: artifact.id,
            ownerId: ctx.user.sub,
            operation: 'upload',
            ctx,
          })
        } else {
          await discardClaimedArtifactAfterFailure({
            artifactId: artifact.id,
            ownerId: ctx.user.sub,
            storageBlob: artifact.storageBlob,
            operation: 'upload',
            ctx,
          })
        }

        finishPackageStorageFailure(telemetry, error)

        if (error instanceof ImportExportDomainError) throw error
        throw new ImportExportDomainError(
          ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
          error
        )
      }
    }
  )
}

export async function reserveElementExportPackageArtifact(
  ctx: PackageStorageContext
) {
  const artifactId = randomUUID()
  const target = createImportExportArtifactStorageTarget({
    direction: 'EXPORT',
    ownerId: ctx.user.sub,
    artifactId,
  })
  const artifactExpiresAt = dayjs()
    .add(getImportExportPackageTtlHours(), 'hours')
    .toDate()
  await reserveImportExportPackageArtifact({
    prisma: ctx.prisma,
    artifactId,
    ownerId: ctx.user.sub,
    direction: ImportExportPackageArtifactDirection.EXPORT,
    storageContainer: target.storageContainer,
    storageBlob: target.storageBlob,
    reservedBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
    expiresAt: artifactExpiresAt,
  })

  return {
    artifactId,
    target,
    reservedBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  }
}

export async function discardElementExportPackageReservation(
  reservation: Awaited<ReturnType<typeof reserveElementExportPackageArtifact>>,
  ctx: PackageStorageContext
) {
  try {
    await ctx.prisma.importExportPackageArtifact.deleteMany({
      where: {
        id: reservation.artifactId,
        ownerId: ctx.user.sub,
        state: ImportExportPackageArtifactState.PENDING,
      },
    })
  } catch {
    await failImportExportPackageArtifact({
      prisma: ctx.prisma,
      artifactId: reservation.artifactId,
      ownerId: ctx.user.sub,
    }).catch(() => undefined)
    emitImportExportTelemetry({
      operation: 'export',
      outcome: 'failure',
      code: 'RESERVATION_RELEASE_FAILED',
    })
  }
}

async function storeElementExportPackage(
  {
    filename,
    buffer,
    reservation,
    publishGuard,
  }: {
    filename: string
    buffer: Buffer
    reservation?: Awaited<
      ReturnType<typeof reserveElementExportPackageArtifact>
    >
    publishGuard: (
      prisma: PrismaTransactionContextWithUser['prisma']
    ) => Promise<void>
  },
  ctx: PackageStorageContext
) {
  const prepared =
    reservation ?? (await reserveElementExportPackageArtifact(ctx))
  const { artifactId, target } = prepared
  let claimed = false
  let storageWriteStarted = false
  let storageWriteCompleted = false
  let telemetry: PackageStorageTelemetrySpan | undefined

  try {
    const resized = await shrinkPendingImportExportPackageArtifact({
      prisma: ctx.prisma,
      artifactId,
      ownerId: ctx.user.sub,
      fromBytes: prepared.reservedBytes,
      toBytes: buffer.length,
    })
    if (!resized) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.INFRASTRUCTURE_FAILURE
      )
    }
    claimed = await claimImportExportPackageArtifact({
      prisma: ctx.prisma,
      artifactId,
      ownerId: ctx.user.sub,
      direction: ImportExportPackageArtifactDirection.EXPORT,
    })
    if (!claimed) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.INFRASTRUCTURE_FAILURE
      )
    }
    telemetry = startPackageStorageTelemetry('export', buffer.length)
    storageWriteStarted = true
    await writePackageArtifactBlobExclusive(target.storageBlob, buffer)
    storageWriteCompleted = true
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    let completed = false
    for (
      let attempt = 1;
      attempt <= EXPORT_PUBLICATION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        completed = await ctx.prisma.$transaction(
          async (prisma) => {
            await publishGuard(prisma)
            return await completeImportExportPackageArtifact({
              prisma,
              artifactId,
              ownerId: ctx.user.sub,
              bytes: buffer.length,
              sha256,
            })
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            maxWait: 5_000,
            timeout: 10_000,
          }
        )
        break
      } catch (error) {
        if (
          attempt < EXPORT_PUBLICATION_ATTEMPTS &&
          error &&
          typeof error === 'object' &&
          Reflect.get(error, 'code') === 'P2034'
        ) {
          continue
        }
        throw error
      }
    }
    if (!completed) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.INFRASTRUCTURE_FAILURE
      )
    }

    const issuedAt = Date.now()
    const expiresAt = new Date(issuedAt + IMPORT_EXPORT_CAPABILITY_MAX_TTL_MS)
    const downloadLink = isLocalImportExportPackageStorageEnabled()
      ? getLocalArtifactDownloadUrl(
          artifactId,
          createLocalArtifactDownloadCapability({
            secret: getImportExportTokenSecret(),
            userId: ctx.user.sub,
            artifactId,
            issuedAt,
            expiresAt: expiresAt.getTime(),
          })
        )
      : createPackageReadSasUrl({
          blobName: target.storageBlob,
          contentType: ZIP_CONTENT_TYPE,
          expiresOn: expiresAt,
        })

    const result = {
      artifactId,
      downloadLink,
      filename,
      expiresAt,
    }
    finishPackageStorageTelemetry(telemetry, 'success', 'PACKAGE_EXPORT_STORED')
    return result
  } catch (error) {
    if (claimed) {
      if (storageWriteStarted && !storageWriteCompleted) {
        await retainUncertainArtifactAfterWriteFailure({
          artifactId,
          ownerId: ctx.user.sub,
          operation: 'export',
          ctx,
        })
      } else {
        await discardClaimedArtifactAfterFailure({
          artifactId,
          ownerId: ctx.user.sub,
          storageBlob: target.storageBlob,
          operation: 'export',
          ctx,
        })
      }
    } else {
      await discardElementExportPackageReservation(prepared, ctx)
    }

    if (telemetry) finishPackageStorageFailure(telemetry, error)

    if (error instanceof ImportExportDomainError) throw error
    throw new ImportExportDomainError(
      ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
      error
    )
  }
}

export async function uploadElementExportPackage(
  {
    filename,
    buffer,
    reservation,
    publishGuard,
  }: {
    filename: string
    buffer: Buffer
    reservation?: Awaited<
      ReturnType<typeof reserveElementExportPackageArtifact>
    >
    publishGuard: (
      prisma: PrismaTransactionContextWithUser['prisma']
    ) => Promise<void>
  },
  ctx: PackageStorageContext
) {
  return await storeElementExportPackage(
    {
      filename: sanitizeFilename(filename),
      buffer,
      reservation,
      publishGuard,
    },
    ctx
  )
}

async function findReadyOwnedArtifact(
  artifactId: string,
  direction: ImportExportPackageArtifactDirection,
  ctx: PackageStorageContext
) {
  if (!isCanonicalImportExportArtifactId(artifactId)) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_NOT_FOUND)
  }

  const artifact = await ctx.prisma.importExportPackageArtifact.findFirst({
    where: {
      id: artifactId,
      ownerId: ctx.user.sub,
      direction,
      state: ImportExportPackageArtifactState.READY,
    },
    select: {
      id: true,
      ownerId: true,
      direction: true,
      storageContainer: true,
      storageBlob: true,
      bytes: true,
      sha256: true,
      expiresAt: true,
    },
  })

  if (!artifact) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_NOT_FOUND)
  }
  if (artifact.expiresAt <= new Date()) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_EXPIRED)
  }
  if (
    !artifact.bytes ||
    !artifact.sha256 ||
    !isCanonicalImportExportArtifactStorageTarget({
      storageContainer: artifact.storageContainer,
      storageBlob: artifact.storageBlob,
      direction: artifact.direction,
      ownerId: artifact.ownerId,
      artifactId: artifact.id,
    })
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.UNSAFE_REFERENCE)
  }

  return artifact
}

export async function resolvePreparedElementImportPackageArtifact(
  { artifactId }: { artifactId: string },
  ctx: PackageStorageContext
) {
  const artifact = await findReadyOwnedArtifact(
    artifactId,
    ImportExportPackageArtifactDirection.IMPORT,
    ctx
  )

  return {
    artifactId: artifact.id,
    bytes: artifact.bytes!,
    sha256: artifact.sha256!,
    expiresAt: artifact.expiresAt,
  }
}

export async function downloadPreparedElementImportPackage(
  { artifactId }: { artifactId: string },
  ctx: PackageStorageContext
) {
  const artifact = await findReadyOwnedArtifact(
    artifactId,
    ImportExportPackageArtifactDirection.IMPORT,
    ctx
  )
  const telemetry = startPackageStorageTelemetry('download', artifact.bytes!)

  try {
    const buffer = await readPackageArtifactBlob(artifact.storageBlob)
    if (
      buffer.length !== artifact.bytes ||
      createHash('sha256').update(buffer).digest('hex') !== artifact.sha256
    ) {
      throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_CHANGED)
    }
    const result = {
      artifactId: artifact.id,
      buffer,
      blobName: artifact.storageBlob,
      sha256: artifact.sha256,
      expiresAt: artifact.expiresAt,
    }
    finishPackageStorageTelemetry(
      telemetry,
      'success',
      'PACKAGE_DOWNLOAD_COMPLETED'
    )
    return result
  } catch (error) {
    finishPackageStorageFailure(telemetry, error)
    throw toPackageDownloadError(error)
  }
}

export async function downloadLocalElementExportPackage(
  {
    artifactId,
    capability,
  }: {
    artifactId: string
    capability: string
  },
  ctx: PackageStorageContext
) {
  await assertCanUseElementImportExport(ctx)
  if (!isLocalImportExportPackageStorageEnabled()) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_NOT_FOUND)
  }

  const artifact = await findReadyOwnedArtifact(
    artifactId,
    ImportExportPackageArtifactDirection.EXPORT,
    ctx
  )
  if (
    !verifyLocalArtifactDownloadCapability({
      token: capability,
      secret: getImportExportTokenSecret(),
      userId: ctx.user.sub,
      artifactId,
    })
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.TOKEN_INVALID)
  }

  const telemetry = startPackageStorageTelemetry('download', artifact.bytes!)
  try {
    const buffer = await readPackageArtifactBlob(artifact.storageBlob)
    if (
      buffer.length !== artifact.bytes ||
      createHash('sha256').update(buffer).digest('hex') !== artifact.sha256
    ) {
      throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_CHANGED)
    }
    finishPackageStorageTelemetry(
      telemetry,
      'success',
      'PACKAGE_DOWNLOAD_COMPLETED'
    )
    return buffer
  } catch (error) {
    finishPackageStorageFailure(telemetry, error)
    throw error
  }
}
