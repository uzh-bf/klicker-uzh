import { createHash, randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  createElementImportToken,
  parseElementImportTokenForOwner,
} from '../lib/elementImportToken.js'
import { createElementSpreadsheetExamples } from '../lib/elementSpreadsheetExamples.js'
import { writeKlickerWorkbook } from '../lib/elementSpreadsheetWorkbook.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
  toImportExportGraphQLError,
} from '../lib/importExportErrors.js'
import { parseElementImportFile } from './elementFileImportParser.js'
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
import {
  downloadPreparedElementImportPackage,
  prepareElementImportPackageUpload,
} from './packageStorage.js'

const hash = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')
const fail = (code: ImportExportErrorCode) => {
  throw new ImportExportDomainError(code)
}

// Retained for source callers of the original workbook adapter.
export const parseElementSpreadsheet = parseElementImportFile

export async function prepareElementSpreadsheetUpload(
  args: { filename: string; bytes: number },
  ctx: ContextWithUser
) {
  try {
    await assertCanUseElementImportExport(ctx)
    const extension = args.filename.toLowerCase().split('.').pop()
    if (!['xlsx', 'json', 'zip'].includes(extension ?? ''))
      fail(ImportExportErrorCode.UNSUPPORTED_FILE_TYPE)
    if (
      !Number.isSafeInteger(args.bytes) ||
      args.bytes <= 0 ||
      args.bytes > (extension === 'xlsx' ? 5 : 10) * 1024 * 1024
    )
      fail(ImportExportErrorCode.UPLOAD_TOO_LARGE)
    // Uploads remain one immutable artifact even when the client groups loose JSON files.
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
        const parsed = await parseElementImportFile(artifact.buffer)
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
            const parsed = await parseElementImportFile(artifact.buffer)
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

/** Excel is an import-only authoring template; selected elements export as JSON ZIP. */
export async function getElementSpreadsheet(
  args: { elementIds: number[] },
  ctx: ContextWithUser
) {
  try {
    await assertCanUseElementImportExport(ctx)
    if (args.elementIds.length) fail(ImportExportErrorCode.INVALID_PACKAGE)
    await assertImportExportRateLimit(ctx, 'export')
    return await withImportExportConcurrencyLease(
      ctx,
      'export',
      async (assertLease) => {
        const buffer = await writeKlickerWorkbook(
          createElementSpreadsheetExamples()
        )
        assertLease()
        return {
          filename: 'klicker-elements-template.xlsx',
          base64: buffer.toString('base64'),
        }
      }
    )
  } catch (error) {
    throw toImportExportGraphQLError(error)
  }
}
