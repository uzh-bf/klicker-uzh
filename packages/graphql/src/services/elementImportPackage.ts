import { randomUUID } from 'node:crypto'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import {
  createElementImportToken,
  parseElementImportTokenForOwner,
} from '../lib/elementImportToken.js'
import {
  getImportExportErrorCode as getTypedImportExportErrorCode,
  ImportExportDomainError,
  ImportExportErrorCode,
  ImportExportWarningCode,
  toImportExportGraphQLError,
} from '../lib/importExportErrors.js'
import {
  omitExternalAutoLoadingAnswerCollectionMediaReferences,
  omitExternalAutoLoadingElementMediaReferences,
} from '../lib/importExportMediaReferences.js'
import { MAX_IMPORT_EXPORT_PACKAGE_BYTES } from '../lib/importExportPackageConfig.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import { executeElementImportExecutionPlan } from './elementImportExecution.js'
import {
  bindStagedImportMedia,
  createElementImportExecutionPlan,
} from './elementImportExecutionPlan.js'
import { buildPreviewWithDuplicateWarnings } from './elementImportPackageDuplicates.js'
import {
  buildImportWarnings,
  collectPackageMediaReferences,
  getImportPackageErrorCode,
  hashBuffer,
  parseElementImportPackage,
  toPublicImportError,
  type NormalizedImportPackage,
  type PackageMedia,
} from './elementImportPackageParser.js'
import type { ElementImportPackagePreview } from './elementImportPreviewModel.js'
import {
  acquireElementImportExecution,
  getElementImportResultWarnings,
  prepareElementImportSelection,
  type DurableImportExecution,
} from './elementImportReceiptOrchestration.js'
import { assertCanUseElementImportExport } from './importExportAuthorization.js'
import {
  assertLiveElementImportReceiptLease,
  completeElementImportReceipt,
} from './importExportPersistence.js'
import { assertImportExportRateLimit } from './importExportRateLimit.js'
import {
  cleanupPendingImportedMediaFile,
  deleteImportedMediaFile,
  finalizeStagedImportedMediaFile,
  reconcileAbandonedImportMediaStaging,
  stageImportedMediaFile,
  type StagedImportedMediaFile,
} from './mediaStorage.js'
import {
  downloadPreparedElementImportPackage,
  prepareElementImportPackageUpload as preparePackageUpload,
} from './packageStorage.js'

const IMPORT_TOKEN_TTL_MS = 60 * 60 * 1000
const IMPORT_RECEIPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const IMPORT_MEDIA_STAGING_TTL_MS = 24 * 60 * 60 * 1000

export async function prepareElementImportPackageUpload(
  { filename, bytes }: { filename: string; bytes: number },
  ctx: ContextWithUser
) {
  const correlationId = randomUUID()
  const startedAt = Date.now()
  emitImportExportTelemetry({
    correlationId,
    operation: 'upload',
    outcome: 'started',
    packageBytes: bytes,
  })
  try {
    await assertCanUseElementImportExport(ctx)

    if (!filename.toLowerCase().endsWith('.zip')) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.UNSUPPORTED_FILE_TYPE
      )
    }
    if (
      !Number.isSafeInteger(bytes) ||
      bytes <= 0 ||
      bytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES
    ) {
      throw new ImportExportDomainError(
        bytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES
          ? ImportExportErrorCode.UPLOAD_TOO_LARGE
          : ImportExportErrorCode.INVALID_PACKAGE
      )
    }

    const result = await preparePackageUpload({ bytes }, ctx)
    emitImportExportTelemetry({
      correlationId,
      operation: 'upload',
      outcome: 'success',
      durationMs: Date.now() - startedAt,
      packageBytes: bytes,
    })
    return result
  } catch (error) {
    emitImportExportTelemetry({
      correlationId,
      operation: 'upload',
      outcome: 'failure',
      code: getTypedImportExportErrorCode(error),
      durationMs: Date.now() - startedAt,
    })
    throw toImportExportGraphQLError(error)
  }
}

export async function validateElementImportPackage(
  args: { artifactId: string },
  ctx: ContextWithUser
) {
  const correlationId = randomUUID()
  const startedAt = Date.now()
  emitImportExportTelemetry({
    correlationId,
    operation: 'validate',
    outcome: 'started',
  })
  try {
    await assertCanUseElementImportExport(ctx)
  } catch (error) {
    emitImportExportTelemetry({
      correlationId,
      operation: 'validate',
      outcome: 'failure',
      code: getTypedImportExportErrorCode(error),
      durationMs: Date.now() - startedAt,
    })
    throw toImportExportGraphQLError(error)
  }

  let buffer: Buffer
  let normalizedPackage: NormalizedImportPackage
  let preview: ElementImportPackagePreview
  let warnings: ImportExportWarningCode[]
  let artifactId: string | null = null
  let artifactSha256: string | null = null
  let artifactExpiresAt: Date | null = null

  try {
    await assertImportExportRateLimit(ctx, 'validate')
    const downloaded = await downloadPreparedElementImportPackage(
      { artifactId: args.artifactId },
      ctx
    )
    buffer = downloaded.buffer
    artifactId = downloaded.artifactId
    artifactSha256 = downloaded.sha256
    artifactExpiresAt = downloaded.expiresAt
    const parsedPackage = parseElementImportPackage(buffer)
    warnings = buildImportWarnings(parsedPackage)
    normalizedPackage = {
      ...parsedPackage,
      elements: parsedPackage.elements.map((element) =>
        omitExternalAutoLoadingElementMediaReferences(element)
      ),
      answerCollections: parsedPackage.answerCollections.map((collection) =>
        omitExternalAutoLoadingAnswerCollectionMediaReferences(collection)
      ),
    }
    preview = await buildPreviewWithDuplicateWarnings(normalizedPackage, ctx)
  } catch (error) {
    const errorCode = getImportPackageErrorCode(error)
    emitImportExportTelemetry({
      correlationId,
      operation: 'validate',
      outcome: 'rejected',
      code: errorCode,
      durationMs: Date.now() - startedAt,
    })

    return {
      importToken: null,
      elements: [],
      answerCollections: [],
      warnings: [],
      errors: [errorCode],
    }
  }

  try {
    const packageHash = hashBuffer(buffer)
    if (!artifactId || artifactSha256 !== packageHash) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.INFRASTRUCTURE_FAILURE
      )
    }
    const importToken = createElementImportToken({
      artifactId,
      packageHash,
      userId: ctx.user.sub,
      expiresAt: Math.min(
        Date.now() + IMPORT_TOKEN_TTL_MS,
        artifactExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY
      ),
      jti: randomUUID(),
    })

    emitImportExportTelemetry({
      correlationId,
      operation: 'validate',
      outcome: 'success',
      durationMs: Date.now() - startedAt,
      packageBytes: buffer.length,
      elementCount: normalizedPackage.elements.length,
      answerCollectionCount: normalizedPackage.answerCollections.length,
      mediaFileCount: normalizedPackage.media.length,
      warningCount: warnings.length,
    })

    return {
      importToken,
      elements: preview.elements,
      answerCollections: preview.answerCollections,
      warnings,
      errors: [],
    }
  } catch (error) {
    emitImportExportTelemetry({
      correlationId,
      operation: 'validate',
      outcome: 'failure',
      code: getTypedImportExportErrorCode(error),
      durationMs: Date.now() - startedAt,
    })
    throw toImportExportGraphQLError(error)
  }
}

type StagedPackageMedia = PackageMedia & {
  staged: StagedImportedMediaFile
}

async function stagePackageMediaFiles(
  mediaFiles: PackageMedia[],
  ctx: ContextWithUser,
  createdStagedMediaHrefs: string[],
  durableExecution?: DurableImportExecution
) {
  const stagedMediaFiles: StagedPackageMedia[] = []
  const stagingExpiresAt = new Date(Date.now() + IMPORT_MEDIA_STAGING_TTL_MS)

  for (const media of mediaFiles) {
    const staged = await stageImportedMediaFile(
      {
        buffer: media.data,
        contentType: media.contentType,
        filename: media.filename,
        originalId: `import-media:${media.sha256}`,
        contentHash: media.sha256,
        durableOperation: durableExecution
          ? {
              receiptId: durableExecution.receiptId,
              operationId: durableExecution.leaseId,
              packageMediaRef: media.ref,
              expiresAt: stagingExpiresAt,
            }
          : undefined,
      },
      ctx
    )
    if (staged.createdBlob && !staged.stagingId) {
      createdStagedMediaHrefs.push(staged.href)
    }
    stagedMediaFiles.push({ ...media, staged })
  }

  return stagedMediaFiles
}

async function finalizePackageMediaFiles(
  mediaFiles: StagedPackageMedia[],
  ctx: PrismaTransactionContextWithUser
) {
  const replacements = new Map<string, string>()
  const unusedStagedMediaHrefs: string[] = []
  const cleanupStagingIds: string[] = []

  for (const media of mediaFiles) {
    const finalized = await finalizeStagedImportedMediaFile(media.staged, ctx)
    replacements.set(media.sourceHref, finalized.href)

    if (finalized.unusedStagedHref) {
      unusedStagedMediaHrefs.push(finalized.unusedStagedHref)
    }
    if (finalized.cleanupStagingId) {
      cleanupStagingIds.push(finalized.cleanupStagingId)
    }
  }

  return {
    replacements,
    unusedStagedMediaHrefs,
    cleanupStagingIds,
  }
}

async function cleanupCreatedImportedMedia(createdMediaHrefs: string[]) {
  await Promise.all(
    createdMediaHrefs.map((href) =>
      Promise.resolve(deleteImportedMediaFile(href)).catch(() => {
        console.error(
          '[ImportExportMediaStorage] Failed to delete imported media blob after failed import'
        )
      })
    )
  )
}

export async function importElementPackage(
  {
    importToken,
    selectedElementRefs,
  }: {
    importToken: string
    selectedElementRefs: string[]
  },
  ctx: ContextWithUser
) {
  const correlationId = randomUUID()
  const startedAt = Date.now()
  emitImportExportTelemetry({
    correlationId,
    operation: 'import',
    outcome: 'started',
    selectedCount: new Set(selectedElementRefs).size,
  })
  try {
    await assertCanUseElementImportExport(ctx)
    const { selectedElementRefs: normalizedSelectedRefs, selectionDigest } =
      prepareElementImportSelection(selectedElementRefs)
    const token = parseElementImportTokenForOwner({
      token: importToken,
      userId: ctx.user.sub,
    })
    const acquired = await acquireElementImportExecution({
      token,
      selectedElementRefs: normalizedSelectedRefs,
      selectionDigest,
      ctx,
    })
    if ('replay' in acquired) {
      const replay = {
        ...acquired.replay,
        warnings: await getElementImportResultWarnings(acquired.receiptId, ctx),
      }
      emitImportExportTelemetry({
        correlationId,
        operation: 'import',
        outcome: 'replayed',
        durationMs: Date.now() - startedAt,
        selectedCount: normalizedSelectedRefs.length,
        elementCount: replay.importedElements,
        answerCollectionCount: replay.importedAnswerCollections,
        skippedCount: replay.skippedElements,
        warningCount: replay.warnings.length,
      })
      return replay
    }

    await reconcileAbandonedImportMediaStaging({
      receiptId: acquired.execution.receiptId,
      ownerId: ctx.user.sub,
      operationId: acquired.execution.leaseId,
      prisma: ctx.prisma,
    })

    const downloaded = await downloadPreparedElementImportPackage(
      { artifactId: token.artifactId },
      ctx
    )

    if (
      downloaded.sha256 !== token.packageHash ||
      hashBuffer(downloaded.buffer) !== token.packageHash
    ) {
      throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_CHANGED)
    }

    const result = await importElementPackageBuffer(
      {
        buffer: downloaded.buffer,
        selectedElementRefs: normalizedSelectedRefs,
        durableExecution: acquired.execution,
      },
      ctx
    )
    const completed = {
      ...result,
      warnings: await getElementImportResultWarnings(
        acquired.execution.receiptId,
        ctx
      ),
    }
    emitImportExportTelemetry({
      correlationId,
      operation: 'import',
      outcome: 'success',
      durationMs: Date.now() - startedAt,
      selectedCount: normalizedSelectedRefs.length,
      elementCount: completed.importedElements,
      answerCollectionCount: completed.importedAnswerCollections,
      skippedCount: completed.skippedElements,
      warningCount: completed.warnings.length,
    })
    return completed
  } catch (error) {
    emitImportExportTelemetry({
      correlationId,
      operation: 'import',
      outcome: 'failure',
      code: getTypedImportExportErrorCode(error),
      durationMs: Date.now() - startedAt,
    })
    throw toPublicImportError(error)
  }
}

export async function importElementPackageBuffer(
  {
    buffer,
    selectedElementRefs,
    durableExecution,
  }: {
    buffer: Buffer
    selectedElementRefs: string[]
    durableExecution?: DurableImportExecution
  },
  ctx: ContextWithUser
) {
  const selectedRefs = new Set(selectedElementRefs)
  if (selectedRefs.size === 0) {
    throw new ImportExportDomainError(ImportExportErrorCode.INVALID_SELECTION)
  }

  const normalizedPackage = parseElementImportPackage(buffer)
  const packageHash = hashBuffer(buffer)
  const selectedElements = normalizedPackage.elements.filter((element) =>
    selectedRefs.has(element.ref)
  )

  if (selectedElements.length !== selectedRefs.size) {
    throw new ImportExportDomainError(ImportExportErrorCode.INVALID_SELECTION)
  }

  const elementsToImport = selectedElements.map((element) =>
    omitExternalAutoLoadingElementMediaReferences(element)
  )
  const skippedElements = 0

  const requiredCollectionRefs = new Set(
    elementsToImport.flatMap((element) =>
      element.answerCollectionRef ? [element.answerCollectionRef] : []
    )
  )
  const collectionsToImport = normalizedPackage.answerCollections
    .filter((collection) => requiredCollectionRefs.has(collection.ref))
    .map((collection) =>
      omitExternalAutoLoadingAnswerCollectionMediaReferences(collection)
    )

  const createdStagedMediaHrefs: string[] = []
  let stagedPackageMediaFiles: StagedPackageMedia[] = []
  let unusedStagedMediaHrefs: string[] = []
  let cleanupStagingIds: string[] = []
  let result: {
    importedElements: number
    importedAnswerCollections: number
    skippedElements: number
  }

  if (elementsToImport.length === 0) {
    result = {
      importedElements: 0,
      importedAnswerCollections: 0,
      skippedElements,
    }
  } else {
    try {
      const selectedMediaUrls = new Set(
        collectPackageMediaReferences({
          elements: elementsToImport,
          answerCollections: collectionsToImport,
        }).map((reference) => reference.href)
      )
      stagedPackageMediaFiles = await stagePackageMediaFiles(
        normalizedPackage.media.filter((media) =>
          selectedMediaUrls.has(media.sourceHref)
        ),
        ctx,
        createdStagedMediaHrefs,
        durableExecution
      )
      const executionPlan = createElementImportExecutionPlan({
        ownerId: ctx.user.sub,
        packageHash,
        answerCollections: collectionsToImport,
        elements: elementsToImport,
        media: normalizedPackage.media,
      })

      const deferredInvalidations: Array<
        | { typename: 'AnswerCollection'; id: number }
        | { typename: 'Element'; id: number }
      > = []
      result = await ctx.prisma.$transaction(
        async (prisma) => {
          if (durableExecution) {
            await assertLiveElementImportReceiptLease({
              prisma,
              receiptId: durableExecution.receiptId,
              ownerId: ctx.user.sub,
              leaseId: durableExecution.leaseId,
            })
          }
          const txCtx: PrismaTransactionContextWithUser = {
            ...ctx,
            prisma,
          }
          const finalizedMedia = await finalizePackageMediaFiles(
            stagedPackageMediaFiles,
            txCtx
          )
          unusedStagedMediaHrefs = finalizedMedia.unusedStagedMediaHrefs
          cleanupStagingIds = finalizedMedia.cleanupStagingIds
          const boundPlan = bindStagedImportMedia(
            executionPlan,
            finalizedMedia.replacements
          )
          const executed = await executeElementImportExecutionPlan({
            plan: boundPlan,
            prisma,
          })
          deferredInvalidations.push(...executed.invalidations)

          if (durableExecution) {
            const completedAt = new Date()
            const completed = await completeElementImportReceipt({
              prisma,
              receiptId: durableExecution.receiptId,
              leaseId: durableExecution.leaseId,
              createdElementIds: executed.createdElementIds,
              createdAnswerCollectionIds: executed.createdAnswerCollectionIds,
              completedAt,
              retentionExpiresAt: new Date(
                completedAt.getTime() + IMPORT_RECEIPT_RETENTION_MS
              ),
            })
            if (!completed) {
              throw new ImportExportDomainError(
                ImportExportErrorCode.IMPORT_IN_PROGRESS
              )
            }
          }

          return {
            importedElements: executed.createdElementIds.length,
            importedAnswerCollections:
              executed.createdAnswerCollectionIds.length,
            skippedElements,
          }
        },
        {
          maxWait: 10_000,
          timeout: 60_000,
        }
      )

      for (const invalidation of deferredInvalidations) {
        try {
          ctx.emitter.emit('invalidate', invalidation)
        } catch {
          // Receipt completion is the commit point. Cache invalidation is
          // best-effort and must not make committed work appear to fail.
          console.error('[ImportExportPackage] Post-commit invalidation failed')
        }
      }
    } catch (error) {
      await cleanupCreatedImportedMedia(createdStagedMediaHrefs)
      throw error
    }
  }

  await cleanupCreatedImportedMedia(unusedStagedMediaHrefs)
  if (durableExecution) {
    for (const stagingId of cleanupStagingIds) {
      try {
        await cleanupPendingImportedMediaFile({
          stagingId,
          ownerId: ctx.user.sub,
          prisma: ctx.prisma,
        })
      } catch {
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'failure',
          code: 'DEFERRED_MEDIA_CLEANUP_FAILED',
          cleanupFailureCount: 1,
        })
      }
    }
  }

  return result
}
