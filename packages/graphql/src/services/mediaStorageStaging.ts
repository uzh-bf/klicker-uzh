import {
  ImportMediaStagingState,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION } from '../lib/importExportFingerprintCanonicalization.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../lib/importExportPackageConfig.js'
import { inferMediaFileExtension } from '../lib/mediaContentTypes.js'
import {
  readAzureImportedMedia,
  writeAzureImportedMediaExclusive,
} from './importExportAzureBlobStorage.js'
import { invalidateAndRefreshElementFingerprintsForFinalizedMediaV1 } from './importExportFingerprints.js'
import {
  createImportedMediaHref,
  readLocalImportedMedia,
  writeLocalImportedMediaExclusive,
} from './importExportMediaBlobStore.js'
import { isLocalImportExportPackageStorageEnabled } from './importExportPackageBlobStore.js'
import { assertLiveElementImportReceiptLease } from './importExportPersistence.js'
import {
  downloadKlickerMediaFile,
  isBlobAlreadyExistsError,
} from './mediaStorageTargets.js'

const IMPORTED_MEDIA_PREFIX = 'imported/'

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

export async function withLiveImportMediaLease<T>(
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
  if (buffer.length === 0) {
    throw new Error('Media file must not be empty.')
  }
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
    if (existing.contentHash !== null && existing.contentHash !== contentHash) {
      throw new Error('Existing imported media has a conflicting content hash.')
    }

    if (
      existing.contentHash === null ||
      existing.importFingerprintVersion !==
        IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
    ) {
      const unclassifiedMedia = existing
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
      }

      await ctx.prisma.$transaction(
        async (prisma) => {
          const updated = await prisma.mediaFile.updateMany({
            where: {
              id: unclassifiedMedia.id,
              ownerId: ctx.user.sub,
              contentHash: unclassifiedMedia.contentHash,
              importFingerprintVersion:
                unclassifiedMedia.importFingerprintVersion,
            },
            data: {
              contentHash,
              importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
            },
          })

          if (updated.count === 1) {
            await invalidateAndRefreshElementFingerprintsForFinalizedMediaV1(
              { href: unclassifiedMedia.href },
              prisma
            )
          }
        },
        { timeout: 60000 }
      )
      existing = await ctx.prisma.mediaFile.findUnique({
        where: {
          ownerId_originalId: {
            ownerId: ctx.user.sub,
            originalId,
          },
        },
      })
    }

    if (
      !existing ||
      existing.contentHash !== contentHash ||
      existing.importFingerprintVersion !==
        IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
    ) {
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
      importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
    },
    update: {},
    select: {
      id: true,
      href: true,
      contentHash: true,
      importFingerprintVersion: true,
    },
  })

  if (
    mediaFile.contentHash !== staged.contentHash ||
    mediaFile.importFingerprintVersion !==
      IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
  ) {
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
