import { createHash, randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  createElementImportToken,
  parseElementImportTokenForOwner,
} from '../lib/elementImportToken.js'
import { parseElementSpreadsheetTables } from '../lib/elementSpreadsheetDomain.js'
import { elementSpreadsheetTablesFromElements } from '../lib/elementSpreadsheetExport.js'
import { emptyElementSpreadsheetTables } from '../lib/elementSpreadsheetTables.js'
import {
  loadElementWorkbook,
  readKlickerWorkbook,
  writeKlickerWorkbook,
} from '../lib/elementSpreadsheetWorkbook.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
  toImportExportGraphQLError,
} from '../lib/importExportErrors.js'
import {
  collectElementMediaReferences,
  MediaReferenceKind,
} from '../lib/importExportMediaReferences.js'
import { parseKahootWorkbook } from '../lib/kahootSpreadsheet.js'
import {
  assertElementExportSnapshotPublishable,
  loadElementExportSnapshot,
} from './elementExportSnapshot.js'
import { executeElementImportExecutionPlan } from './elementImportExecution.js'
import {
  bindStagedImportMedia,
  createElementImportExecutionPlan,
} from './elementImportExecutionPlan.js'
import { createElementImportPreviewModel } from './elementImportPreviewModel.js'
import {
  acquireElementImportExecution,
  findCompletedElementImportExecution,
  prepareElementImportSelection,
  withElementImportReceiptHeartbeat,
} from './elementImportReceiptOrchestration.js'
import { findSpreadsheetDuplicates } from './elementSpreadsheetDuplicates.js'
import { assertCanUseElementImportExport } from './importExportAuthorization.js'
import { withImportExportConcurrencyLease } from './importExportConcurrency.js'
import { refreshElementDidacticFingerprint } from './importExportFingerprintPersistence.js'
import {
  assertLiveElementImportReceiptLease,
  completeElementImportReceipt,
  findElementImportReceiptByJti,
} from './importExportPersistence.js'
import { assertImportExportRateLimit } from './importExportRateLimit.js'
import { resolveKlickerMediaHref } from './mediaStorage.js'
import {
  downloadPreparedElementImportPackage,
  prepareElementImportPackageUpload,
} from './packageStorage.js'
import { createStorageAwarePortableExportPlan } from './portableExportMediaHydration.js'

const hash = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')
const fail = (code: ImportExportErrorCode) => {
  throw new ImportExportDomainError(code)
}

export async function parseElementSpreadsheet(buffer: Buffer) {
  const workbook = await loadElementWorkbook(buffer)
  const parsed = workbook.getWorksheet('Instructions')
    ? (() => {
        const read = readKlickerWorkbook(workbook)
        return parseElementSpreadsheetTables(read.tables, read.issues)
      })()
    : parseKahootWorkbook(workbook)
  const invalid = new Set<string>()
  for (const element of parsed.elements) {
    const source = parsed.sources.find((source) => source.ref === element.ref)!
    for (const reference of collectElementMediaReferences(element)) {
      if (reference.kind !== MediaReferenceKind.AUTO_LOAD) continue
      // Classification is local and never fetches a user-controlled URL. Keep
      // public first-party references even if their source blob was deleted.
      if (!resolveKlickerMediaHref(reference.href)) {
        invalid.add(element.ref)
        parsed.issues.push({
          ...source,
          field: 'image',
          code: 'INVALID_IMAGE_URL',
        })
      } else {
        parsed.issues.push({
          ...source,
          field: 'image',
          code: 'SOURCE_IMAGE_DEPENDENCY',
        })
      }
    }
  }
  return {
    ...parsed,
    elements: parsed.elements.filter((element) => !invalid.has(element.ref)),
  }
}

export async function prepareElementSpreadsheetUpload(
  args: { filename: string; bytes: number },
  ctx: ContextWithUser
) {
  try {
    await assertCanUseElementImportExport(ctx)
    if (!args.filename.toLowerCase().endsWith('.xlsx'))
      fail(ImportExportErrorCode.UNSUPPORTED_FILE_TYPE)
    if (
      !Number.isSafeInteger(args.bytes) ||
      args.bytes <= 0 ||
      args.bytes > 5 * 1024 * 1024
    )
      fail(ImportExportErrorCode.UPLOAD_TOO_LARGE)
    // Artifact transport is ZIP bytes; XLSX parsing is exclusively below the
    // spreadsheet mutation boundary. Existing ZIP upload contracts stay intact.
    return await prepareElementImportPackageUpload({ bytes: args.bytes }, ctx)
  } catch (error) {
    throw toImportExportGraphQLError(error)
  }
}

export async function validateElementSpreadsheet(
  args: { artifactId: string },
  ctx: ContextWithUser
) {
  try {
    await assertCanUseElementImportExport(ctx)
    await assertImportExportRateLimit(ctx, 'validate')
    return await withImportExportConcurrencyLease(
      ctx,
      'validate',
      async (assertLease) => {
        const artifact = await downloadPreparedElementImportPackage(args, ctx)
        assertLease()
        if (hash(artifact.buffer) !== artifact.sha256)
          fail(ImportExportErrorCode.PACKAGE_CHANGED)
        const parsed = await parseElementSpreadsheet(artifact.buffer)
        const duplicates = await findSpreadsheetDuplicates({
          ...parsed,
          ownerId: ctx.user.sub,
          prisma: ctx.prisma,
        })
        const model = createElementImportPreviewModel({
          ...parsed,
          media: [],
        }).preview
        assertLease()
        return {
          importToken: parsed.elements.length
            ? createElementImportToken({
                artifactId: artifact.artifactId,
                packageHash: artifact.sha256,
                userId: ctx.user.sub,
                expiresAt: Math.min(
                  Date.now() + 3_600_000,
                  artifact.expiresAt.getTime()
                ),
                jti: randomUUID(),
              })
            : null,
          elements: model.elements.map((element) => ({
            ...element,
            alreadyImported: duplicates.has(element.ref),
            existingElementId: duplicates.get(element.ref)?.id,
            existingElementName: duplicates.get(element.ref)?.name,
          })),
          answerCollections: model.answerCollections,
          sources: parsed.sources,
          issues: parsed.issues,
        }
      }
    )
  } catch (error) {
    throw toImportExportGraphQLError(error)
  }
}

export async function importElementSpreadsheet(
  args: { importToken: string; selectedElementRefs: string[] },
  ctx: ContextWithUser
) {
  try {
    await assertCanUseElementImportExport(ctx)
    const selection = prepareElementImportSelection(args.selectedElementRefs)
    const token = parseElementImportTokenForOwner({
      token: args.importToken,
      userId: ctx.user.sub,
    })
    const readResult = async () => {
      const receipt = await findElementImportReceiptByJti({
        jti: token.jti,
        prisma: ctx.prisma,
      })
      if (
        !receipt ||
        receipt.ownerId !== ctx.user.sub ||
        receipt.state !== 'COMPLETE'
      )
        return fail(ImportExportErrorCode.INFRASTRUCTURE_FAILURE)
      return {
        importedElements: (receipt.createdElementIds as number[]).length,
        skippedElementRefs: receipt.skippedElementRefs,
      }
    }
    if (await findCompletedElementImportExecution({ token, ...selection, ctx }))
      return await readResult()
    await assertImportExportRateLimit(ctx, 'import')
    return await withImportExportConcurrencyLease(
      ctx,
      'import',
      async (assertConcurrencyLease) => {
        const acquired = await acquireElementImportExecution({
          token,
          ...selection,
          ctx,
        })
        if ('replay' in acquired) return await readResult()
        return await withElementImportReceiptHeartbeat({
          execution: acquired.execution,
          ctx,
          callback: async (lease) => {
            const artifact = await downloadPreparedElementImportPackage(
              { artifactId: token.artifactId },
              ctx
            )
            if (
              hash(artifact.buffer) !== token.packageHash ||
              artifact.sha256 !== token.packageHash
            )
              fail(ImportExportErrorCode.PACKAGE_CHANGED)
            const parsed = await parseElementSpreadsheet(artifact.buffer)
            const selected = parsed.elements.filter((element) =>
              selection.selectedElementRefs.includes(element.ref)
            )
            if (selected.length !== selection.selectedElementRefs.length)
              fail(ImportExportErrorCode.INVALID_SELECTION)
            await lease.renewNow()
            const executed = await ctx.prisma.$transaction(
              async (prisma) => {
                assertConcurrencyLease()
                lease.assertLease()
                await assertLiveElementImportReceiptLease({
                  prisma,
                  ...acquired.execution,
                  ownerId: ctx.user.sub,
                })
                // Serializes imports into this owner's library. No global/user-data lock.
                await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`element-spreadsheet:${ctx.user.sub}`}, 0))`
                const duplicates = await findSpreadsheetDuplicates({
                  ownerId: ctx.user.sub,
                  elements: selected,
                  answerCollections: parsed.answerCollections,
                  prisma,
                })
                const elements = selected.filter(
                  (element) => !duplicates.has(element.ref)
                )
                const collections = parsed.answerCollections.filter(
                  (collection) =>
                    elements.some(
                      (element) =>
                        element.answerCollectionRef === collection.ref
                    )
                )
                const plan = bindStagedImportMedia(
                  createElementImportExecutionPlan({
                    ownerId: ctx.user.sub,
                    packageHash: token.packageHash,
                    elements,
                    answerCollections: collections,
                    media: [],
                  }),
                  new Map()
                )
                const result = await executeElementImportExecutionPlan({
                  plan,
                  prisma,
                })
                for (const id of result.createdElementIds)
                  await refreshElementDidacticFingerprint(id, prisma)
                const skippedElementRefs = selected
                  .filter((element) => duplicates.has(element.ref))
                  .map((element) => element.ref)
                lease.assertLease()
                assertConcurrencyLease()
                const completedAt = new Date()
                if (
                  !(await completeElementImportReceipt({
                    prisma,
                    ...acquired.execution,
                    createdElementIds: result.createdElementIds,
                    createdAnswerCollectionIds:
                      result.createdAnswerCollectionIds,
                    skippedElementRefs,
                    completedAt,
                    retentionExpiresAt: new Date(
                      completedAt.getTime() + 30 * 86400_000
                    ),
                  }))
                )
                  fail(ImportExportErrorCode.IMPORT_IN_PROGRESS)
                return { ...result, skippedElementRefs }
              },
              { maxWait: 10_000, timeout: 60_000 }
            )
            for (const invalidation of executed.invalidations) {
              try {
                ctx.emitter.emit('invalidate', invalidation)
              } catch {
                /* Committed receipt remains authoritative. */
              }
            }
            return {
              importedElements: executed.createdElementIds.length,
              skippedElementRefs: executed.skippedElementRefs,
            }
          },
        })
      }
    )
  } catch (error) {
    throw toImportExportGraphQLError(error)
  }
}

export async function getElementSpreadsheet(
  args: { elementIds: number[] },
  ctx: ContextWithUser
) {
  try {
    await assertCanUseElementImportExport(ctx)
    await assertImportExportRateLimit(ctx, 'export')
    return await withImportExportConcurrencyLease(
      ctx,
      'export',
      async (assertLease) => {
        if (!args.elementIds.length)
          return {
            filename: 'klicker-elements-template.xlsx',
            base64: (
              await writeKlickerWorkbook(emptyElementSpreadsheetTables())
            ).toString('base64'),
          }
        const snapshot = await loadElementExportSnapshot(args.elementIds, ctx)
        const plan = createStorageAwarePortableExportPlan(snapshot)
        const buffer = await writeKlickerWorkbook(
          elementSpreadsheetTablesFromElements(
            plan.elements.map((element) => element.content),
            plan.answerCollections.map((collection) => collection.content)
          )
        )
        assertLease()
        await ctx.prisma.$transaction(async (prisma) => {
          await assertElementExportSnapshotPublishable(snapshot.revision, {
            ...ctx,
            prisma,
          })
        })
        return {
          filename: 'klicker-elements.xlsx',
          base64: buffer.toString('base64'),
        }
      }
    )
  } catch (error) {
    throw toImportExportGraphQLError(error)
  }
}
