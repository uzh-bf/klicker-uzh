import builder from '../builder.js'
import type { ElementWorkbookIssue as IElementWorkbookIssue } from '../services/elementWorkbook.js'

export const ElementWorkbookImportAction = builder.enumType(
  'ElementWorkbookImportAction',
  { values: ['CREATE', 'SKIP_EXISTING', 'SKIP_WORKBOOK'] as const }
)

export const ElementWorkbookUnsupportedReason = builder.enumType(
  'ElementWorkbookUnsupportedReason',
  {
    values: [
      'TYPE_NOT_SUPPORTED',
      'TOO_MANY_ANSWERS',
      'NOT_REPRESENTABLE',
    ] as const,
  }
)

export const ElementWorkbookIssue = builder
  .objectRef<IElementWorkbookIssue>('ElementWorkbookIssue')
  .implement({
    fields: (t) => ({
      code: t.exposeString('code'),
      sheet: t.exposeString('sheet', { nullable: true }),
      row: t.exposeInt('row', { nullable: true }),
      column: t.exposeString('column', { nullable: true }),
    }),
  })

export const ElementWorkbookUpload = builder
  .objectRef<{ uploadId: string; uploadUrl: string }>('ElementWorkbookUpload')
  .implement({
    fields: (t) => ({
      uploadId: t.exposeString('uploadId'),
      uploadUrl: t.exposeString('uploadUrl'),
    }),
  })

export const ElementWorkbookFile = builder
  .objectRef<{ filename: string; contentBase64: string }>('ElementWorkbookFile')
  .implement({
    fields: (t) => ({
      filename: t.exposeString('filename'),
      contentBase64: t.exposeString('contentBase64'),
    }),
  })

interface IElementWorkbookPreviewRow {
  sheet: string
  row: number
  name: string
  type: string
  action: 'CREATE' | 'SKIP_EXISTING' | 'SKIP_WORKBOOK'
  existingElementId: number | null
  existingElementName: string | null
  firstRow: number | null
}

export const ElementWorkbookPreviewRow = builder
  .objectRef<IElementWorkbookPreviewRow>('ElementWorkbookPreviewRow')
  .implement({
    fields: (t) => ({
      sheet: t.exposeString('sheet'),
      row: t.exposeInt('row'),
      name: t.exposeString('name'),
      type: t.exposeString('type'),
      action: t.expose('action', { type: ElementWorkbookImportAction }),
      existingElementId: t.exposeInt('existingElementId', { nullable: true }),
      existingElementName: t.exposeString('existingElementName', {
        nullable: true,
      }),
      firstRow: t.exposeInt('firstRow', { nullable: true }),
    }),
  })

export const ElementWorkbookPreview = builder
  .objectRef<{
    previewToken: string | null
    rows: IElementWorkbookPreviewRow[]
    imagesToCopy: number
    error: IElementWorkbookIssue | null
  }>('ElementWorkbookPreview')
  .implement({
    fields: (t) => ({
      previewToken: t.exposeString('previewToken', { nullable: true }),
      rows: t.expose('rows', { type: [ElementWorkbookPreviewRow] }),
      imagesToCopy: t.exposeInt('imagesToCopy'),
      error: t.expose('error', {
        type: ElementWorkbookIssue,
        nullable: true,
      }),
    }),
  })

export const ElementWorkbookImportResult = builder
  .objectRef<{
    createdElementIds: number[]
    skippedCount: number
    error: IElementWorkbookIssue | null
  }>('ElementWorkbookImportResult')
  .implement({
    fields: (t) => ({
      createdElementIds: t.exposeIntList('createdElementIds'),
      skippedCount: t.exposeInt('skippedCount'),
      error: t.expose('error', {
        type: ElementWorkbookIssue,
        nullable: true,
      }),
    }),
  })

interface IElementWorkbookUnsupported {
  id: number
  name: string
  type: string
  reason: 'TYPE_NOT_SUPPORTED' | 'TOO_MANY_ANSWERS' | 'NOT_REPRESENTABLE'
}

export const ElementWorkbookUnsupported = builder
  .objectRef<IElementWorkbookUnsupported>('ElementWorkbookUnsupported')
  .implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
      type: t.exposeString('type'),
      reason: t.expose('reason', { type: ElementWorkbookUnsupportedReason }),
    }),
  })

export const ElementWorkbookExport = builder
  .objectRef<{
    filename: string
    downloadUrl: string | null
    exportedIds: number[]
    unsupported: IElementWorkbookUnsupported[]
  }>('ElementWorkbookExport')
  .implement({
    fields: (t) => ({
      filename: t.exposeString('filename'),
      downloadUrl: t.exposeString('downloadUrl', { nullable: true }),
      exportedIds: t.exposeIntList('exportedIds'),
      unsupported: t.expose('unsupported', {
        type: [ElementWorkbookUnsupported],
      }),
    }),
  })
