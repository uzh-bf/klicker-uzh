import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type { SpreadsheetIssue } from '../lib/elementSpreadsheetTables.js'
import * as service from '../services/elementSpreadsheet.js'
import {
  ElementImportPackagePreviewAnswerCollection,
  ElementImportPackagePreviewElement,
  ElementImportPackageUpload,
} from './elementImportExport.js'

const auth = {
  authenticated: true,
  role: UserRole.USER,
  scope: UserLoginScope.FULL_ACCESS,
}
const issue = builder
  .objectRef<SpreadsheetIssue>('ElementSpreadsheetIssue')
  .implement({
    fields: (t) => ({
      sheet: t.exposeString('sheet'),
      row: t.exposeInt('row'),
      ref: t.exposeString('ref', { nullable: true }),
      field: t.exposeString('field'),
      code: t.exposeString('code'),
    }),
  })
const source = builder
  .objectRef<{ ref: string; sheet: string; row: number; name: string }>(
    'ElementSpreadsheetSource'
  )
  .implement({
    fields: (t) => ({
      ref: t.exposeString('ref'),
      sheet: t.exposeString('sheet'),
      row: t.exposeInt('row'),
      name: t.exposeString('name'),
    }),
  })
const preview = builder
  .objectRef<Awaited<ReturnType<typeof service.validateElementSpreadsheet>>>(
    'ElementSpreadsheetPreview'
  )
  .implement({
    fields: (t) => ({
      importToken: t.exposeString('importToken', { nullable: true }),
      elements: t.expose('elements', {
        type: [ElementImportPackagePreviewElement],
      }),
      answerCollections: t.expose('answerCollections', {
        type: [ElementImportPackagePreviewAnswerCollection],
      }),
      sources: t.expose('sources', { type: [source] }),
      issues: t.expose('issues', { type: [issue] }),
    }),
  })
const result = builder
  .objectRef<Awaited<ReturnType<typeof service.importElementSpreadsheet>>>(
    'ElementSpreadsheetResult'
  )
  .implement({
    fields: (t) => ({
      importedElements: t.exposeInt('importedElements'),
      skippedElementRefs: t.exposeStringList('skippedElementRefs'),
    }),
  })
const download = builder
  .objectRef<{ filename: string; base64: string }>('ElementSpreadsheetDownload')
  .implement({
    fields: (t) => ({
      filename: t.exposeString('filename'),
      base64: t.exposeString('base64'),
    }),
  })
builder.queryField('getElementSpreadsheet', (t) =>
  t.withAuth(auth).field({
    type: download,
    args: { elementIds: t.arg.intList({ required: true }) },
    resolve: (_, args, ctx) => service.getElementSpreadsheet(args, ctx),
  })
)
builder.mutationFields((t) => ({
  prepareElementSpreadsheetUpload: t.withAuth(auth).field({
    type: ElementImportPackageUpload,
    args: {
      filename: t.arg.string({ required: true }),
      bytes: t.arg.int({ required: true }),
    },
    resolve: (_, args, ctx) =>
      service.prepareElementSpreadsheetUpload(args, ctx),
  }),
  validateElementSpreadsheet: t.withAuth(auth).field({
    type: preview,
    args: { artifactId: t.arg.string({ required: true }) },
    resolve: (_, args, ctx) => service.validateElementSpreadsheet(args, ctx),
  }),
  importElementSpreadsheet: t.withAuth(auth).field({
    type: result,
    args: {
      importToken: t.arg.string({ required: true }),
      selectedElementRefs: t.arg.stringList({ required: true }),
    },
    resolve: (_, args, ctx) => service.importElementSpreadsheet(args, ctx),
  }),
}))
