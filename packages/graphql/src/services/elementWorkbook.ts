import { createHash } from 'node:crypto'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  executeImport,
  previewImport,
} from '../lib/elementWorkbook/database.js'
import { ElementImportError } from '../lib/elementWorkbook/errors.js'
import { exportElementWorkbook as buildExportWorkbook } from '../lib/elementWorkbook/export.js'
import {
  copyImagesForImport,
  countImagesToCopy,
  rewriteImageLinks,
} from '../lib/elementWorkbook/media.js'
import {
  ElementWorkbookParseError,
  MAX_ELEMENT_WORKBOOK_BYTES,
  MAX_ELEMENT_WORKBOOK_ELEMENTS,
  parseElementWorkbook,
  type WorkbookElement,
} from '../lib/elementWorkbook/parse.js'
import { digest } from '../lib/elementWorkbook/plan.js'
import {
  createWorkbookUpload,
  deleteWorkbookUpload,
  ElementWorkbookStorageError,
  readWorkbookUpload,
  storeWorkbookDownload,
} from '../lib/elementWorkbook/storage.js'
import {
  createTemplateExamples,
  writeElementWorkbook,
} from '../lib/elementWorkbook/template.js'

export type ElementWorkbookIssue = {
  code: string
  sheet?: string | null
  row?: number | null
  column?: string | null
}

// Parsing, image copies and storage I/O are comparatively heavy, so each
// lecturer gets a fixed budget of workbook operations per minute.
const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 60
const RATE_LIMITED = { code: 'RATE_LIMITED' }

async function withinRateLimit(ctx: ContextWithUser) {
  const key = `element-workbook:rate:${ctx.user.sub}`
  const count = await ctx.redisExec.incr(key)
  if (count === 1) await ctx.redisExec.expire(key, RATE_WINDOW_SECONDS)
  return count <= RATE_LIMIT
}

async function assertWithinRateLimit(ctx: ContextWithUser) {
  if (!(await withinRateLimit(ctx)))
    throw new GraphQLError('RATE_LIMITED', {
      extensions: { code: 'RATE_LIMITED' },
    })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Reads and parses an upload, mapping expected failures to a typed issue. */
async function readWorkbook(
  userId: string,
  uploadId: string
): Promise<
  | { bytes: Buffer; elements: WorkbookElement[] }
  | { issue: ElementWorkbookIssue }
> {
  try {
    const bytes = await readWorkbookUpload(
      userId,
      uploadId,
      MAX_ELEMENT_WORKBOOK_BYTES
    )
    return { bytes, elements: await parseElementWorkbook(bytes) }
  } catch (error) {
    if (error instanceof ElementWorkbookStorageError)
      return { issue: { code: error.code } }
    if (error instanceof ElementWorkbookParseError)
      return {
        issue: {
          code: error.code,
          sheet: error.sheet ?? null,
          row: error.row ?? null,
          column: error.column ?? null,
        },
      }
    throw error
  }
}

export async function getElementWorkbookTemplate(ctx: ContextWithUser) {
  await assertWithinRateLimit(ctx)
  return {
    filename: 'klickeruzh-element-template.xlsx',
    contentBase64: (
      await writeElementWorkbook(createTemplateExamples())
    ).toString('base64'),
  }
}

export async function prepareElementWorkbookUpload(ctx: ContextWithUser) {
  await assertWithinRateLimit(ctx)
  return createWorkbookUpload(ctx.user.sub)
}

export async function previewElementWorkbookImport(
  { uploadId }: { uploadId: string },
  ctx: ContextWithUser
) {
  const empty = { previewToken: null, rows: [], imagesToCopy: 0 }
  if (!(await withinRateLimit(ctx))) return { ...empty, error: RATE_LIMITED }
  const workbook = await readWorkbook(ctx.user.sub, uploadId)
  if ('issue' in workbook) return { ...empty, error: workbook.issue }
  if (workbook.elements.length === 0)
    return { ...empty, error: { code: 'EMPTY_WORKBOOK' } }

  const preview = await previewImport(
    ctx.prisma,
    ctx.user.sub,
    workbook.elements
  )
  const existingIds = preview.decisions.flatMap((decision) =>
    decision.existingId === undefined ? [] : [decision.existingId]
  )
  const existing = await ctx.prisma.element.findMany({
    where: { id: { in: existingIds }, ownerId: ctx.user.sub },
    select: { id: true, name: true },
  })
  const names = new Map(existing.map((element) => [element.id, element.name]))
  const created = workbook.elements.filter(
    (_, index) => preview.decisions[index]!.action === 'CREATE'
  )

  return {
    previewToken: digest(preview),
    rows: preview.decisions.map((decision, index) => ({
      sheet: decision.sheet,
      row: decision.row,
      name: decision.name,
      type: workbook.elements[index]!.type,
      action: decision.action,
      existingElementId: decision.existingId ?? null,
      existingElementName:
        decision.existingId === undefined
          ? null
          : (names.get(decision.existingId) ?? null),
      firstRow: decision.firstRow ?? null,
    })),
    imagesToCopy: await countImagesToCopy(ctx.prisma, ctx.user.sub, created),
    error: null,
  }
}

export async function importElementWorkbook(
  { uploadId, previewToken }: { uploadId: string; previewToken: string },
  ctx: ContextWithUser
) {
  if (!(await withinRateLimit(ctx)))
    return { createdElementIds: [], skippedCount: 0, error: RATE_LIMITED }
  const workbook = await readWorkbook(ctx.user.sub, uploadId)
  if ('issue' in workbook)
    return { createdElementIds: [], skippedCount: 0, error: workbook.issue }

  const stale = {
    createdElementIds: [],
    skippedCount: 0,
    error: { code: 'PREVIEW_STALE' },
  }
  // Re-plan before copying images, so only rows that will be created get
  // copies and a stale preview fails before any storage work.
  const plan = await previewImport(ctx.prisma, ctx.user.sub, workbook.elements)
  if (digest(plan) !== previewToken) return stale
  // Copies are registered by source link before the transaction, so a failed
  // or repeated import reuses them instead of copying again.
  const links = await copyImagesForImport(
    ctx.prisma,
    ctx.user.sub,
    workbook.elements.filter(
      (_, index) => plan.decisions[index]!.action === 'CREATE'
    )
  )
  try {
    const result = await executeImport(
      ctx.prisma,
      ctx.user.sub,
      rewriteImageLinks(workbook.elements, links),
      previewToken,
      createHash('sha256').update(workbook.bytes).digest('hex')
    )
    await deleteWorkbookUpload(ctx.user.sub, uploadId).catch(() => undefined)
    return {
      createdElementIds: result.created.map((element) => element.id),
      skippedCount: result.skipped.length,
      error: null,
    }
  } catch (error) {
    // The library changed since the preview, or a concurrent import holds the
    // owner's lock; both are resolved by previewing again.
    if (error instanceof ElementImportError) return stale
    throw error
  }
}

export async function exportElementWorkbook(
  { elementIds, includeTags }: { elementIds: number[]; includeTags: boolean },
  ctx: ContextWithUser
) {
  await assertWithinRateLimit(ctx)
  const ids = [...new Set(elementIds)]
  if (ids.length > MAX_ELEMENT_WORKBOOK_ELEMENTS)
    throw new GraphQLError('TOO_MANY_ELEMENTS', {
      extensions: { code: 'TOO_MANY_ELEMENTS' },
    })
  const elements = await ctx.prisma.element.findMany({
    where: {
      id: { in: ids },
      isDeleted: false,
      permissions: { some: { userId: ctx.user.sub } },
    },
    select: {
      id: true,
      type: true,
      name: true,
      content: true,
      explanation: true,
      basePoints: true,
      pointsMultiplier: true,
      options: true,
      // Tags are personal and are never shared with other users.
      tags: {
        where: { ownerId: ctx.user.sub },
        orderBy: { order: 'asc' },
        select: { name: true },
      },
    },
  })
  // Keep the lecturer's selection order in the file.
  const order = new Map(ids.map((id, index) => [id, index]))
  elements.sort((a, b) => order.get(a.id)! - order.get(b.id)!)

  const result = await buildExportWorkbook(
    elements.map((element) => ({
      ...element,
      tags: element.tags.map((tag) => tag.name),
    })),
    { includeTags }
  )
  const filename = `klickeruzh-elements-${today()}.xlsx`
  return {
    filename,
    downloadUrl:
      result.exportedIds.length > 0
        ? await storeWorkbookDownload(ctx.user.sub, result.buffer, filename)
        : null,
    exportedIds: result.exportedIds,
    unsupported: result.unsupported,
  }
}
