import {
  ImportMediaStagingState,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { IMPORT_EXPORT_FINGERPRINT_VERSION } from '../lib/importExportFingerprintCanonicalization.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../lib/importExportPackageConfig.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import {
  DEFAULT_MEDIA_CONTENT_TYPE,
  inferMediaFileExtension,
} from '../lib/mediaContentTypes.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import {
  deleteAzureImportedMediaIfExists,
  getAzureImportedMediaProperties,
  getAzureImportExportStorageAccountUrl,
  isAzureImportExportStorageConfigured,
  readAzureImportedMedia,
  writeAzureImportedMediaExclusive,
} from './importExportAzureBlobStorage.js'
import {
  createImportedMediaHref,
  deleteLocalImportedMediaIfExists,
  isCanonicalImportedMediaTarget,
  parseLocalImportedMediaHref,
  readLocalImportedMedia,
  statLocalImportedMedia,
  writeLocalImportedMediaExclusive,
} from './importExportMediaBlobStore.js'
import { isLocalImportExportPackageStorageEnabled } from './importExportPackageBlobStore.js'
import {
  assertLiveElementImportReceiptLease,
  findExpiredImportMediaStagingForCleanup,
} from './importExportPersistence.js'

const PACKAGE_CONTAINER_NAME = 'klicker-import-export'
const IMPORTED_MEDIA_PREFIX = 'imported/'

type BlobLocation = {
  containerName: string
  blobName: string
}

type MediaContext = Pick<
  ContextWithUser | PrismaTransactionContextWithUser,
  'prisma'
>

export type StagedImportedMediaFile = {
  id: string
  href: string
  ownerId: string
  contentType: string
  filename: string
  originalId: string
  contentHash: string
  createdBlob: boolean
  stagingId?: string
  operationId?: string
}

export type DurableImportMediaOperation = {
  receiptId: string
  operationId: string
  packageMediaRef: string
  expiresAt: Date
}

async function withLiveImportMediaLease<T>(
  prisma: PrismaClient,
  operation: Pick<DurableImportMediaOperation, 'receiptId' | 'operationId'>,
  ownerId: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>
) {
  return await prisma.$transaction(async (tx) => {
    await assertLiveElementImportReceiptLease({
      prisma: tx,
      receiptId: operation.receiptId,
      ownerId,
      leaseId: operation.operationId,
    })
    return await action(tx)
  })
}

export function isImportExportMediaStorageConfigured() {
  return (
    isLocalImportExportPackageStorageEnabled() ||
    isAzureImportExportStorageConfigured()
  )
}

function getStorageAccount() {
  return getAzureImportExportStorageAccountUrl()
}

function isBlobNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const statusCode = Reflect.get(error, 'statusCode')
  const code = Reflect.get(error, 'code')
  const details = Reflect.get(error, 'details')
  const detailCode =
    details && typeof details === 'object'
      ? Reflect.get(details, 'errorCode')
      : undefined

  return (
    statusCode === 404 ||
    code === 'ENOENT' ||
    code === 'BlobNotFound' ||
    detailCode === 'BlobNotFound'
  )
}

function isBlobAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const statusCode = Reflect.get(error, 'statusCode')
  const code = Reflect.get(error, 'code')
  const details = Reflect.get(error, 'details')
  const detailCode =
    details && typeof details === 'object'
      ? Reflect.get(details, 'errorCode')
      : undefined

  return (
    statusCode === 409 ||
    statusCode === 412 ||
    code === 'BlobAlreadyExists' ||
    code === 'ConditionNotMet' ||
    detailCode === 'BlobAlreadyExists' ||
    detailCode === 'ConditionNotMet'
  )
}

export function parseKlickerMediaUrl(href: string): BlobLocation | null {
  const localLocation = parseLocalImportedMediaHref(href)
  if (localLocation) return localLocation

  let url: URL

  try {
    url = new URL(href)
  } catch {
    return null
  }

  let storageAccount: string
  try {
    storageAccount = getStorageAccount()
  } catch {
    return null
  }

  if (url.origin !== storageAccount) {
    return null
  }

  const [containerName, ...blobParts] = url.pathname.split('/').filter(Boolean)

  if (
    !containerName ||
    containerName === PACKAGE_CONTAINER_NAME ||
    blobParts.length === 0
  ) {
    return null
  }

  return {
    containerName,
    blobName: blobParts.join('/'),
  }
}

function getCanonicalImportedMediaHref(location: BlobLocation) {
  return isLocalImportExportPackageStorageEnabled()
    ? createImportedMediaHref(location.containerName, location.blobName)
    : `${getStorageAccount()}/${location.containerName}/${location.blobName}`
}

async function readImportedMediaTarget(location: BlobLocation) {
  if (isLocalImportExportPackageStorageEnabled()) {
    return await readLocalImportedMedia(
      location.containerName,
      location.blobName
    )
  }

  return await readAzureImportedMedia(location, MAX_IMPORT_EXPORT_MEDIA_BYTES)
}

async function getImportedMediaTargetProperties(location: BlobLocation) {
  if (isLocalImportExportPackageStorageEnabled()) {
    return await statLocalImportedMedia(
      location.containerName,
      location.blobName
    )
  }
  return await getAzureImportedMediaProperties(location)
}

async function deleteImportedMediaTarget(location: BlobLocation) {
  if (isLocalImportExportPackageStorageEnabled()) {
    return await deleteLocalImportedMediaIfExists(
      location.containerName,
      location.blobName
    )
  }
  return await deleteAzureImportedMediaIfExists(location)
}

export async function downloadKlickerMediaFile(
  href: string,
  ctx: MediaContext
) {
  const location = parseKlickerMediaUrl(href)
  if (!location) return null

  const canonicalHref = getCanonicalImportedMediaHref(location)
  const mediaFile = await ctx.prisma.mediaFile.findUnique({
    where: { href: canonicalHref },
    select: {
      id: true,
      name: true,
      originalId: true,
      ownerId: true,
      type: true,
    },
  })

  if (!mediaFile || mediaFile.ownerId !== location.containerName) {
    return null
  }

  let properties
  try {
    properties = await getImportedMediaTargetProperties(location)
  } catch (error) {
    if (isBlobNotFoundError(error)) return null
    throw error
  }
  const contentLength = properties.contentLength
  if (
    typeof contentLength !== 'number' ||
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0
  ) {
    throw new MediaExportOmissionError('unknown-size')
  }
  if (contentLength > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
    throw new MediaExportOmissionError('too-large')
  }

  let buffer
  try {
    buffer = await readImportedMediaTarget(location)
  } catch (error) {
    if (isBlobNotFoundError(error)) return null
    throw error
  }
  return {
    buffer,
    contentType:
      mediaFile.type ?? properties.contentType ?? DEFAULT_MEDIA_CONTENT_TYPE,
    filename: mediaFile.name || path.basename(location.blobName) || 'media',
    originalId: mediaFile.originalId ?? mediaFile.id,
  }
}

export async function isKlickerMediaFileExportable(
  href: string,
  ctx: MediaContext
) {
  const location = parseKlickerMediaUrl(href)
  if (!location) return false

  const canonicalHref = getCanonicalImportedMediaHref(location)
  const mediaFile = await ctx.prisma.mediaFile.findUnique({
    where: { href: canonicalHref },
    select: { ownerId: true },
  })

  return Boolean(mediaFile && mediaFile.ownerId === location.containerName)
}

async function mapMediaMetadataWithConcurrency<T, Result>(
  values: readonly T[],
  callback: (value: T) => Promise<Result>
) {
  const results = new Array<Result>(values.length)
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(4, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++
        results[index] = await callback(values[index]!)
      }
    })
  )
  return results
}

export async function getKlickerMediaFilesExportMetadata(
  hrefs: string[],
  ctx: MediaContext
) {
  const requested = hrefs.flatMap((href) => {
    const location = parseKlickerMediaUrl(href)
    return location
      ? [
          {
            href,
            location,
            canonicalHref: getCanonicalImportedMediaHref(location),
          },
        ]
      : []
  })
  if (requested.length === 0) return new Map()
  const mediaFiles = await ctx.prisma.mediaFile.findMany({
    where: { href: { in: requested.map((item) => item.canonicalHref) } },
    select: {
      id: true,
      href: true,
      name: true,
      originalId: true,
      ownerId: true,
      type: true,
    },
  })
  const mediaFileByHref = new Map(
    mediaFiles.map((mediaFile) => [mediaFile.href, mediaFile])
  )
  const metadata = await mapMediaMetadataWithConcurrency(
    requested,
    async ({ href, location, canonicalHref }) => {
      const mediaFile = mediaFileByHref.get(canonicalHref)
      if (!mediaFile || mediaFile.ownerId !== location.containerName) {
        return [href, null] as const
      }

      let properties
      try {
        properties = await getImportedMediaTargetProperties(location)
      } catch (error) {
        if (isBlobNotFoundError(error)) return [href, null] as const
        throw error
      }
      const bytes = properties.contentLength
      if (
        typeof bytes !== 'number' ||
        !Number.isSafeInteger(bytes) ||
        bytes <= 0
      ) {
        return [href, null] as const
      }

      return [
        href,
        {
          bytes,
          contentType:
            mediaFile.type ??
            properties.contentType ??
            DEFAULT_MEDIA_CONTENT_TYPE,
          filename:
            mediaFile.name || path.basename(location.blobName) || 'media',
          originalId: mediaFile.originalId ?? mediaFile.id,
        },
      ] as const
    }
  )

  return new Map(metadata)
}

export async function getKlickerMediaFileExportMetadata(
  href: string,
  ctx: MediaContext
) {
  return (
    (await getKlickerMediaFilesExportMetadata([href], ctx)).get(href) ?? null
  )
}

export async function deleteImportedMediaFile(href: string) {
  const location = parseKlickerMediaUrl(href)
  if (!location) return

  await deleteImportedMediaTarget(location)
}

export async function getLocalImportedMediaDownload(
  {
    ownerId,
    filename,
  }: {
    ownerId: string
    filename: string
  },
  ctx: MediaContext
) {
  const storageBlob = `imported/${filename}`
  const href = createImportedMediaHref(ownerId, storageBlob)
  const mediaFile = await ctx.prisma.mediaFile.findFirst({
    where: { ownerId, href },
    select: { type: true },
  })
  if (!mediaFile) return null

  return {
    buffer: await readLocalImportedMedia(ownerId, storageBlob),
    contentType: mediaFile.type,
  }
}

export async function stageImportedMediaFile(
  {
    buffer,
    contentType,
    filename,
    originalId,
    contentHash,
    durableOperation,
  }: {
    buffer: Buffer
    contentType: string
    filename: string
    originalId: string
    contentHash: string
    durableOperation?: DurableImportMediaOperation
  },
  ctx: ContextWithUser
) {
  if (buffer.length > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
    throw new Error('Media file is too large.')
  }
  if (
    !/^[a-f0-9]{64}$/.test(contentHash) ||
    createHash('sha256').update(buffer).digest('hex') !== contentHash
  ) {
    throw new Error('Media content hash does not match the staged bytes.')
  }

  if (durableOperation) {
    await withLiveImportMediaLease(
      ctx.prisma,
      durableOperation,
      ctx.user.sub,
      async () => undefined
    )
  }

  let existing = await ctx.prisma.mediaFile.findUnique({
    where: {
      ownerId_originalId: {
        ownerId: ctx.user.sub,
        originalId,
      },
    },
  })

  if (existing) {
    if (existing.contentHash === null) {
      const downloaded = await downloadKlickerMediaFile(existing.href, ctx)
      if (
        !downloaded ||
        createHash('sha256').update(downloaded.buffer).digest('hex') !==
          contentHash
      ) {
        throw new Error(
          'Existing imported media could not be verified against the package.'
        )
      }

      await ctx.prisma.mediaFile.updateMany({
        where: {
          id: existing.id,
          ownerId: ctx.user.sub,
          contentHash: null,
        },
        data: {
          contentHash,
          importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        },
      })
      existing = await ctx.prisma.mediaFile.findUnique({
        where: {
          ownerId_originalId: {
            ownerId: ctx.user.sub,
            originalId,
          },
        },
      })
    }

    if (!existing || existing.contentHash !== contentHash) {
      throw new Error('Existing imported media has a conflicting content hash.')
    }

    return {
      id: existing.id,
      href: existing.href,
      ownerId: existing.ownerId,
      contentType: existing.type,
      filename: existing.name,
      originalId: existing.originalId ?? originalId,
      contentHash,
      createdBlob: false,
    }
  }

  if (!durableOperation && !isLocalImportExportPackageStorageEnabled()) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.INFRASTRUCTURE_FAILURE
    )
  }

  const extension = inferMediaFileExtension(contentType, filename)
  let id: string = randomUUID()
  let blobName = `${IMPORTED_MEDIA_PREFIX}${id}.${extension}`
  let stagingId: string | undefined

  if (durableOperation) {
    if (durableOperation.expiresAt <= new Date()) {
      throw new Error('Import media staging expiry must be in the future.')
    }

    const staging = await withLiveImportMediaLease(
      ctx.prisma,
      durableOperation,
      ctx.user.sub,
      async (tx) => {
        let current = await tx.importMediaStaging.findUnique({
          where: {
            receiptId_packageMediaRef: {
              receiptId: durableOperation.receiptId,
              packageMediaRef: durableOperation.packageMediaRef,
            },
          },
        })

        if (!current) {
          current = await tx.importMediaStaging.create({
            data: {
              id,
              operationId: durableOperation.operationId,
              receiptId: durableOperation.receiptId,
              ownerId: ctx.user.sub,
              packageMediaRef: durableOperation.packageMediaRef,
              contentHash,
              storageContainer: ctx.user.sub,
              storageBlob: blobName,
              expiresAt: durableOperation.expiresAt,
            },
          })
        }

        if (
          current.ownerId !== ctx.user.sub ||
          current.receiptId !== durableOperation.receiptId ||
          current.packageMediaRef !== durableOperation.packageMediaRef ||
          current.operationId !== durableOperation.operationId ||
          current.contentHash !== contentHash ||
          current.state === ImportMediaStagingState.FINALIZED ||
          current.state === ImportMediaStagingState.CLEANUP_PENDING
        ) {
          throw new Error('Import media staging identity does not match.')
        }

        const claimed = await tx.importMediaStaging.updateMany({
          where: {
            id: current.id,
            ownerId: ctx.user.sub,
            receiptId: durableOperation.receiptId,
            operationId: durableOperation.operationId,
            contentHash,
            state: {
              in: [
                ImportMediaStagingState.RESERVED,
                ImportMediaStagingState.COPIED,
              ],
            },
          },
          data: { expiresAt: durableOperation.expiresAt },
        })
        if (claimed.count !== 1) {
          throw new Error('Import media staging could not be claimed.')
        }

        return current
      }
    )

    id = staging.id
    blobName = staging.storageBlob
    stagingId = staging.id
  }

  const href = createImportedMediaHref(ctx.user.sub, blobName)

  if (isLocalImportExportPackageStorageEnabled()) {
    const created = await writeLocalImportedMediaExclusive(
      ctx.user.sub,
      blobName,
      buffer
    )
    if (!created && !durableOperation) {
      throw new Error('Imported media target already exists.')
    }
    if (!created) {
      const existingBuffer = await readLocalImportedMedia(
        ctx.user.sub,
        blobName
      )
      if (
        existingBuffer.length !== buffer.length ||
        createHash('sha256').update(existingBuffer).digest('hex') !==
          contentHash
      ) {
        throw new Error('Existing staged media bytes do not match the package.')
      }
    }
  } else {
    try {
      await writeAzureImportedMediaExclusive({
        location: { containerName: ctx.user.sub, blobName },
        buffer,
        contentType,
        contentHash,
      })
    } catch (error) {
      if (!durableOperation || !isBlobAlreadyExistsError(error)) throw error

      const existingBuffer = await readAzureImportedMedia(
        { containerName: ctx.user.sub, blobName },
        MAX_IMPORT_EXPORT_MEDIA_BYTES
      )
      if (
        existingBuffer.length !== buffer.length ||
        createHash('sha256').update(existingBuffer).digest('hex') !==
          contentHash
      ) {
        throw new Error('Existing staged media bytes do not match the package.')
      }
    }
  }

  if (durableOperation && stagingId) {
    await withLiveImportMediaLease(
      ctx.prisma,
      durableOperation,
      ctx.user.sub,
      async (tx) => {
        const copied = await tx.importMediaStaging.updateMany({
          where: {
            id: stagingId,
            ownerId: ctx.user.sub,
            receiptId: durableOperation.receiptId,
            operationId: durableOperation.operationId,
            contentHash,
            state: {
              in: [
                ImportMediaStagingState.RESERVED,
                ImportMediaStagingState.COPIED,
              ],
            },
          },
          data: {
            state: ImportMediaStagingState.COPIED,
            createdBlob: true,
          },
        })
        if (copied.count !== 1) {
          throw new Error('Copied import media staging could not be recorded.')
        }
      }
    )
  }

  return {
    id,
    href,
    ownerId: ctx.user.sub,
    contentType,
    filename,
    originalId,
    contentHash,
    createdBlob: true,
    stagingId,
    operationId: durableOperation?.operationId,
  }
}

export async function finalizeStagedImportedMediaFile(
  staged: StagedImportedMediaFile,
  ctx: PrismaTransactionContextWithUser
) {
  const mediaFile = await ctx.prisma.mediaFile.upsert({
    where: {
      ownerId_originalId: {
        ownerId: staged.ownerId,
        originalId: staged.originalId,
      },
    },
    create: {
      id: staged.id,
      ownerId: staged.ownerId,
      type: staged.contentType,
      name: staged.filename,
      href: staged.href,
      originalId: staged.originalId,
      contentHash: staged.contentHash,
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    },
    update: {},
    select: {
      id: true,
      href: true,
      contentHash: true,
    },
  })

  if (mediaFile.contentHash !== staged.contentHash) {
    throw new Error('Imported media has a conflicting content hash.')
  }

  const unusedStagedHref =
    !staged.createdBlob || mediaFile.href === staged.href ? null : staged.href

  if (staged.stagingId && staged.operationId) {
    const finalized = await ctx.prisma.importMediaStaging.updateMany({
      where: {
        id: staged.stagingId,
        ownerId: staged.ownerId,
        operationId: staged.operationId,
        contentHash: staged.contentHash,
        state: ImportMediaStagingState.COPIED,
      },
      data: unusedStagedHref
        ? {
            state: ImportMediaStagingState.CLEANUP_PENDING,
            mediaFileId: null,
          }
        : {
            state: ImportMediaStagingState.FINALIZED,
            mediaFileId: mediaFile.id,
          },
    })
    if (finalized.count !== 1) {
      throw new Error('Import media staging could not be finalized.')
    }
  }

  return {
    href: mediaFile.href,
    unusedStagedHref,
    ...(unusedStagedHref && staged.stagingId
      ? { cleanupStagingId: staged.stagingId }
      : {}),
  }
}

export async function cleanupPendingImportedMediaFile({
  stagingId,
  ownerId,
  prisma,
}: {
  stagingId: string
  ownerId: string
  prisma: PrismaClient
}) {
  const staging = await prisma.importMediaStaging.findFirst({
    where: {
      id: stagingId,
      ownerId,
      state: ImportMediaStagingState.CLEANUP_PENDING,
    },
  })
  if (!staging) return true

  if (
    !isCanonicalImportedMediaTarget({
      ownerId,
      storageContainer: staging.storageContainer,
      storageBlob: staging.storageBlob,
    })
  ) {
    return false
  }

  await deleteImportedMediaTarget({
    containerName: staging.storageContainer,
    blobName: staging.storageBlob,
  })
  const deleted = await prisma.importMediaStaging.deleteMany({
    where: {
      id: staging.id,
      ownerId,
      state: ImportMediaStagingState.CLEANUP_PENDING,
    },
  })

  return deleted.count === 1
}

export async function reconcileAbandonedImportMediaStaging({
  receiptId,
  ownerId,
  operationId,
  prisma,
}: {
  receiptId: string
  ownerId: string
  operationId: string
  prisma: PrismaClient
}) {
  await withLiveImportMediaLease(
    prisma,
    {
      receiptId,
      operationId,
    },
    ownerId,
    async (tx) => {
      const abandoned = await tx.importMediaStaging.findMany({
        where: {
          receiptId,
          ownerId,
          operationId: { not: operationId },
          state: {
            in: [
              ImportMediaStagingState.RESERVED,
              ImportMediaStagingState.COPIED,
              ImportMediaStagingState.CLEANUP_PENDING,
            ],
          },
        },
        select: { id: true, operationId: true },
      })

      for (const staging of abandoned) {
        const reconciled = await tx.importMediaStaging.updateMany({
          where: {
            id: staging.id,
            receiptId,
            ownerId,
            operationId: staging.operationId,
            state: {
              in: [
                ImportMediaStagingState.RESERVED,
                ImportMediaStagingState.COPIED,
                ImportMediaStagingState.CLEANUP_PENDING,
              ],
            },
          },
          data: {
            // Free the receipt/ref uniqueness key for the new fenced attempt
            // while retaining this exact target as a cleanup ledger.
            packageMediaRef: `orphan:${staging.id}`,
            state: ImportMediaStagingState.CLEANUP_PENDING,
            mediaFileId: null,
          },
        })
        if (reconciled.count !== 1) {
          throw new Error('Abandoned import media staging could not be fenced.')
        }
      }
    }
  )
}

export async function cleanupOrphanedImportedMediaFiles({
  prisma,
  now = new Date(),
  dryRun = false,
}: {
  prisma: PrismaClient
  now?: Date
  dryRun?: boolean
}) {
  const cleanupBatchSize = 100
  const maxCleanupBatches = 10
  let deletedMediaFiles = 0
  let deletedStagingRecords = 0
  let wouldDeleteMediaFiles = 0
  let failedMediaCleanups = 0
  let unsafeMediaTargets = 0
  let cleanupBatches = 0
  const attemptedIds: string[] = []

  for (let batch = 0; batch < maxCleanupBatches; batch++) {
    const candidates = await findExpiredImportMediaStagingForCleanup({
      prisma,
      now,
      batchSize: cleanupBatchSize,
      excludeIds: attemptedIds,
    })
    if (candidates.length === 0) break

    cleanupBatches++
    attemptedIds.push(...candidates.map((candidate) => candidate.id))

    for (const candidate of candidates) {
      const canonicalTarget = isCanonicalImportedMediaTarget({
        ownerId: candidate.ownerId,
        storageContainer: candidate.storageContainer,
        storageBlob: candidate.storageBlob,
      })
      if (!canonicalTarget) {
        unsafeMediaTargets++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'rejected',
          code: 'UNSAFE_MEDIA_CLEANUP_TARGET',
        })
        continue
      }

      // A RESERVED row may already have a blob when the process crashed after
      // Azure accepted the upload but before COPIED was recorded. The exact
      // target is owned by this ledger, so cleanup must always deleteIfExists.
      wouldDeleteMediaFiles++
      if (dryRun) continue

      try {
        if (!isImportExportMediaStorageConfigured()) {
          throw new Error('Imported media storage is unavailable.')
        }

        if (candidate.state !== ImportMediaStagingState.CLEANUP_PENDING) {
          const claimed = await prisma.importMediaStaging.updateMany({
            where: {
              id: candidate.id,
              expiresAt: { lte: now },
              state: candidate.state,
              receipt: {
                NOT: {
                  state: 'PENDING',
                  leaseExpiresAt: { gt: now },
                },
              },
            },
            data: { state: ImportMediaStagingState.CLEANUP_PENDING },
          })
          if (claimed.count !== 1) continue
        }

        const deletedBlob = await deleteImportedMediaTarget({
          containerName: candidate.storageContainer,
          blobName: candidate.storageBlob,
        })
        if (deletedBlob) deletedMediaFiles++

        const deleted = await prisma.importMediaStaging.deleteMany({
          where: {
            id: candidate.id,
            expiresAt: { lte: now },
            state: ImportMediaStagingState.CLEANUP_PENDING,
          },
        })
        deletedStagingRecords += deleted.count
      } catch {
        failedMediaCleanups++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'failure',
          code: 'MEDIA_CLEANUP_FAILED',
        })
      }
    }

    if (candidates.length < cleanupBatchSize) break
  }

  const cleanupBacklogRemaining =
    attemptedIds.length === cleanupBatchSize * maxCleanupBatches &&
    (
      await findExpiredImportMediaStagingForCleanup({
        prisma,
        now,
        batchSize: 1,
        excludeIds: attemptedIds,
      })
    ).length > 0

  return {
    deletedMediaFiles,
    deletedStagingRecords,
    wouldDeleteMediaFiles,
    failedMediaCleanups,
    unsafeMediaTargets,
    cleanupBatches,
    cleanupBacklogRemaining,
  }
}
