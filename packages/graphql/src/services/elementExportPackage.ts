import * as DB from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  getImportExportErrorCode as getTypedImportExportErrorCode,
  ImportExportDomainError,
  ImportExportErrorCode,
  ImportExportWarningCode,
} from '../lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_ELEMENTS } from '../lib/importExportPackageConfig.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import { createZip } from '../lib/zip.js'
import {
  assertElementExportSnapshotPublishable,
  loadElementExportSnapshot,
} from './elementExportSnapshot.js'
import { toPublicExportError } from './elementImportPackageParser.js'
import { assertCanUseElementImportExport } from './importExportAuthorization.js'
import { withImportExportConcurrencyLease } from './importExportConcurrency.js'
import { assertImportExportRateLimit } from './importExportRateLimit.js'
import {
  discardElementExportPackageReservation,
  reserveElementExportPackageArtifact,
  uploadElementExportPackage,
} from './packageStorage.js'
import {
  createStorageAwarePortableExportPlan,
  hydratePortableExportMediaOutcomes,
  loadPortableExportPreviewMediaOutcomes,
} from './portableExportMediaHydration.js'
import {
  getPortableExportPlanWarnings,
  renderPortableExportPackage,
  type PortableExportPlan,
} from './portableExportPlan.js'

const EXPORT_PREVIEW_ERROR_ELEMENT_PERMISSION =
  ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION
const EXPORT_PREVIEW_ERROR_ANSWER_COLLECTION_PERMISSION =
  ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION
const EXPORT_PREVIEW_ERROR_TOO_MANY_ELEMENTS =
  ImportExportErrorCode.TOO_MANY_ELEMENTS
const EXPORT_PREVIEW_ERROR_PACKAGE_TOO_LARGE =
  ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
const EXPORT_PREVIEW_ERROR_NON_PORTABLE =
  ImportExportErrorCode.ELEMENT_NOT_PORTABLE

export type ElementExportPackagePreviewElement = {
  id: number
  name: string
  type: DB.ElementType
  answerCollectionRef?: string | null
}

export type ElementExportPackagePreviewAnswerCollection = {
  ref: string
  name: string
  description: string
  entries: Array<{ id: number; value: string }>
  elementNames: string[]
}

function emptyExportPackagePreview(errors: ImportExportErrorCode[]) {
  return {
    elements: [],
    answerCollections: [],
    warnings: [],
    errors,
  }
}

export async function createElementExportPackage(
  { elementIds }: { elementIds: number[] },
  ctx: ContextWithUser
) {
  const snapshot = await loadElementExportSnapshot(elementIds, ctx)
  const plan = createStorageAwarePortableExportPlan(snapshot)
  const mediaOutcomes = await hydratePortableExportMediaOutcomes(plan, ctx)
  const rendered = renderPortableExportPackage({
    plan,
    mediaOutcomes,
    createdAt: new Date().toISOString(),
  })
  if (rendered.exceedsPackageLimit) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  }
  const packageFiles = rendered.files.map(({ path, data }) => {
    if (data === null) {
      throw new Error('Hydrated export plan contains missing media bytes.')
    }
    return { path, data }
  })
  const buffer = createZip(packageFiles)
  if (buffer.length !== rendered.storedZipBytes) {
    throw new Error('Rendered export archive accounting is inconsistent.')
  }
  const filename = `klicker-elements-${randomUUID()}.zip`

  emitImportExportTelemetry({
    operation: 'export',
    outcome: 'success',
    code: 'PACKAGE_CREATED',
    packageBytes: buffer.length,
    elementCount: plan.elements.length,
    answerCollectionCount: plan.answerCollections.length,
    mediaFileCount: rendered.manifest.media.length,
    warningCount: rendered.warnings.length,
  })

  return {
    filename,
    buffer,
    revision: snapshot.revision,
  }
}

export async function getElementExportPackageLink(
  { elementIds }: { elementIds: number[] },
  ctx: ContextWithUser
) {
  const correlationId = randomUUID()
  const startedAt = Date.now()
  emitImportExportTelemetry({
    correlationId,
    operation: 'export',
    outcome: 'started',
    elementCount: new Set(elementIds).size,
  })
  try {
    await assertCanUseElementImportExport(ctx)
    await assertImportExportRateLimit(ctx, 'export')

    const result = await withImportExportConcurrencyLease(
      ctx,
      'export',
      async (assertLease) => {
        assertLease()
        const reservation = await reserveElementExportPackageArtifact(ctx)
        try {
          const { filename, buffer, revision } =
            await createElementExportPackage({ elementIds }, ctx)

          assertLease()
          return await uploadElementExportPackage(
            {
              filename,
              buffer,
              reservation,
              publishGuard: async (prisma) =>
                await assertElementExportSnapshotPublishable(revision, {
                  ...ctx,
                  prisma,
                }),
            },
            ctx
          )
        } catch (error) {
          await discardElementExportPackageReservation(reservation, ctx)
          throw error
        }
      }
    )
    emitImportExportTelemetry({
      correlationId,
      operation: 'export',
      outcome: 'success',
      durationMs: Date.now() - startedAt,
      elementCount: new Set(elementIds).size,
    })
    return result
  } catch (error) {
    emitImportExportTelemetry({
      correlationId,
      operation: 'export',
      outcome: 'failure',
      durationMs: Date.now() - startedAt,
      code: getTypedImportExportErrorCode(error),
    })
    throw toPublicExportError(error)
  }
}

async function getElementExportPackagePreviewInternal(
  { elementIds }: { elementIds: number[] },
  ctx: ContextWithUser,
  assertLease: () => void
) {
  assertLease()
  const uniqueElementIds = Array.from(new Set(elementIds))
  if (uniqueElementIds.length === 0) {
    throw new ImportExportDomainError(ImportExportErrorCode.INVALID_SELECTION)
  }
  if (uniqueElementIds.length > MAX_IMPORT_EXPORT_ELEMENTS) {
    return emptyExportPackagePreview([EXPORT_PREVIEW_ERROR_TOO_MANY_ELEMENTS])
  }

  let snapshot: Awaited<ReturnType<typeof loadElementExportSnapshot>>
  let plan: PortableExportPlan
  try {
    assertLease()
    snapshot = await loadElementExportSnapshot(uniqueElementIds, ctx)
    assertLease()
    plan = createStorageAwarePortableExportPlan(snapshot)
    assertLease()
  } catch (error) {
    assertLease()
    if (error instanceof ImportExportDomainError) {
      switch (error.code) {
        case ImportExportErrorCode.ELEMENT_EXPORT_PERMISSION:
          return emptyExportPackagePreview([
            EXPORT_PREVIEW_ERROR_ELEMENT_PERMISSION,
          ])
        case ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION:
          return emptyExportPackagePreview([
            EXPORT_PREVIEW_ERROR_ANSWER_COLLECTION_PERMISSION,
          ])
        case ImportExportErrorCode.ELEMENT_NOT_PORTABLE:
          return emptyExportPackagePreview([EXPORT_PREVIEW_ERROR_NON_PORTABLE])
        case ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT:
          return emptyExportPackagePreview([
            ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
          ])
        case ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE:
          return emptyExportPackagePreview([
            EXPORT_PREVIEW_ERROR_PACKAGE_TOO_LARGE,
          ])
      }
    }
    throw error
  }

  let warnings: readonly ImportExportWarningCode[] =
    getPortableExportPlanWarnings(plan)
  let errors: ImportExportErrorCode[] = []
  try {
    assertLease()
    const mediaOutcomes = await loadPortableExportPreviewMediaOutcomes(
      plan,
      ctx,
      assertLease
    )
    assertLease()
    const rendered = renderPortableExportPackage({
      plan,
      mediaOutcomes,
      createdAt: new Date(0).toISOString(),
    })
    assertLease()
    warnings = rendered.warnings
    if (rendered.exceedsPackageLimit) {
      errors = [EXPORT_PREVIEW_ERROR_PACKAGE_TOO_LARGE]
    }
  } catch (error) {
    assertLease()
    if (error instanceof ImportExportDomainError) {
      if (error.code === ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE) {
        errors = [EXPORT_PREVIEW_ERROR_PACKAGE_TOO_LARGE]
      } else if (error.code === ImportExportErrorCode.ELEMENT_NOT_PORTABLE) {
        errors = [EXPORT_PREVIEW_ERROR_NON_PORTABLE]
      } else {
        throw error
      }
    } else {
      throw error
    }
  }

  const result = {
    elements: plan.elements.map((element) => ({
      id: element.sourceId,
      name: element.content.name,
      type: element.content.type,
      answerCollectionRef: element.manifest.answerCollectionRef ?? null,
    })),
    answerCollections: plan.answerCollections.map((collection) => {
      const source = snapshot.answerCollections.find(
        ({ id }) => id === collection.sourceId
      )!
      return {
        ref: collection.content.ref,
        name: collection.content.name,
        description: collection.content.description,
        entries: source.entries,
        elementNames: plan.elements
          .filter(
            (element) => element.answerCollectionId === collection.sourceId
          )
          .map((element) => element.content.name),
      }
    }),
    warnings: [...warnings],
    errors,
  }
  assertLease()
  return result
}

export async function getElementExportPackagePreview(
  args: { elementIds: number[] },
  ctx: ContextWithUser
) {
  const correlationId = randomUUID()
  const startedAt = Date.now()
  emitImportExportTelemetry({
    correlationId,
    operation: 'preview',
    outcome: 'started',
    elementCount: new Set(args.elementIds).size,
  })
  try {
    await assertCanUseElementImportExport(ctx)
    await assertImportExportRateLimit(ctx, 'preview')
    const result = await withImportExportConcurrencyLease(
      ctx,
      'preview',
      async (assertLease) =>
        getElementExportPackagePreviewInternal(args, ctx, assertLease)
    )
    emitImportExportTelemetry({
      correlationId,
      operation: 'preview',
      outcome: result.errors.length > 0 ? 'rejected' : 'success',
      durationMs: Date.now() - startedAt,
      elementCount: result.elements.length,
      answerCollectionCount: result.answerCollections.length,
      warningCount: result.warnings.length,
      errorCount: result.errors.length,
    })
    return result
  } catch (error) {
    emitImportExportTelemetry({
      correlationId,
      operation: 'preview',
      outcome: 'failure',
      durationMs: Date.now() - startedAt,
      code: getTypedImportExportErrorCode(error),
    })
    throw toPublicExportError(error)
  }
}
