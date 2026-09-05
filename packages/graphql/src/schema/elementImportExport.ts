import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode as ImportExportErrorCodeEnum,
  ImportExportWarningCode as ImportExportWarningCodeEnum,
  toImportExportGraphQLError,
  type ImportExportErrorCode as ImportExportErrorCodeType,
  type ImportExportWarningCode as ImportExportWarningCodeType,
} from '../lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_ELEMENTS } from '../lib/importExportPackageConfig.js'
import * as ElementImportExportService from '../services/elementImportExport.js'
import type { ElementImportPackagePreviewElement as ElementImportPackagePreviewElementSource } from '../services/elementImportPreviewModel.js'
import * as ImportExportAuthorizationService from '../services/importExportAuthorization.js'
import { ElementStatus, ElementType } from './elementData.js'
import {
  createElementImportPackagePreviewOptions,
  ElementImportPackagePreviewOptions,
} from './elementImportPreviewOptions.js'

export const ImportExportErrorCode = builder.enumType('ImportExportErrorCode', {
  values: Object.values(ImportExportErrorCodeEnum),
})
export const ImportExportWarningCode = builder.enumType(
  'ImportExportWarningCode',
  { values: Object.values(ImportExportWarningCodeEnum) }
)

export interface IElementExportPackageLink {
  downloadLink: string
  filename?: string
  expiresAt?: Date
}
export const ElementExportPackageLinkRef =
  builder.objectRef<IElementExportPackageLink>('ElementExportPackageLink')
export const ElementExportPackageLink = ElementExportPackageLinkRef.implement({
  fields: (t) => ({
    downloadLink: t.exposeString('downloadLink'),
    filename: t.exposeString('filename', { nullable: true }),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
  }),
})

export interface IElementExportPackagePreviewElement {
  id: number
  name: string
  type: DB.ElementType
  answerCollectionRef?: string | null
}
export const ElementExportPackagePreviewElementRef =
  builder.objectRef<IElementExportPackagePreviewElement>(
    'ElementExportPackagePreviewElement'
  )
export const ElementExportPackagePreviewElement =
  ElementExportPackagePreviewElementRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
      type: t.expose('type', { type: ElementType }),
      answerCollectionRef: t.exposeString('answerCollectionRef', {
        nullable: true,
      }),
    }),
  })

export interface IElementExportPackagePreviewEntry {
  id: number
  value: string
}
export const ElementExportPackagePreviewEntryRef =
  builder.objectRef<IElementExportPackagePreviewEntry>(
    'ElementExportPackagePreviewEntry'
  )
export const ElementExportPackagePreviewEntry =
  ElementExportPackagePreviewEntryRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      value: t.exposeString('value'),
    }),
  })

export interface IElementExportPackagePreviewAnswerCollection {
  ref: string
  name: string
  description: string
  entries: IElementExportPackagePreviewEntry[]
  elementNames: string[]
}
export const ElementExportPackagePreviewAnswerCollectionRef =
  builder.objectRef<IElementExportPackagePreviewAnswerCollection>(
    'ElementExportPackagePreviewAnswerCollection'
  )
export const ElementExportPackagePreviewAnswerCollection =
  ElementExportPackagePreviewAnswerCollectionRef.implement({
    fields: (t) => ({
      ref: t.exposeString('ref'),
      name: t.exposeString('name'),
      description: t.exposeString('description'),
      entries: t.expose('entries', {
        type: [ElementExportPackagePreviewEntry],
      }),
      elementNames: t.exposeStringList('elementNames'),
    }),
  })

export interface IElementExportPackagePreview {
  elements: IElementExportPackagePreviewElement[]
  answerCollections: IElementExportPackagePreviewAnswerCollection[]
  warnings: ImportExportWarningCodeType[]
  errors: ImportExportErrorCodeType[]
}
export const ElementExportPackagePreviewRef =
  builder.objectRef<IElementExportPackagePreview>('ElementExportPackagePreview')
export const ElementExportPackagePreview =
  ElementExportPackagePreviewRef.implement({
    fields: (t) => ({
      elements: t.expose('elements', {
        type: [ElementExportPackagePreviewElement],
      }),
      answerCollections: t.expose('answerCollections', {
        type: [ElementExportPackagePreviewAnswerCollection],
      }),
      warnings: t.expose('warnings', { type: [ImportExportWarningCode] }),
      errors: t.expose('errors', { type: [ImportExportErrorCode] }),
    }),
  })

export interface IElementImportPackageUpload {
  uploadURL: string
  uploadCapability: string
  artifactId: string
  expiresAt: Date
}
export const ElementImportPackageUploadRef =
  builder.objectRef<IElementImportPackageUpload>('ElementImportPackageUpload')
export const ElementImportPackageUpload =
  ElementImportPackageUploadRef.implement({
    fields: (t) => ({
      uploadURL: t.exposeString('uploadURL'),
      uploadCapability: t.exposeString('uploadCapability'),
      artifactId: t.exposeString('artifactId'),
      expiresAt: t.expose('expiresAt', { type: 'Date' }),
    }),
  })

export interface IElementImportPackagePreviewEntry {
  id: number
  value: string
}
export const ElementImportPackagePreviewEntryRef =
  builder.objectRef<IElementImportPackagePreviewEntry>(
    'ElementImportPackagePreviewEntry'
  )
export const ElementImportPackagePreviewEntry =
  ElementImportPackagePreviewEntryRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      value: t.exposeString('value'),
    }),
  })

export interface IElementImportPackagePreviewAnswerCollection {
  ref: string
  name: string
  description: string
  alreadyImported: boolean
  existingAnswerCollectionId?: number | null
  existingAnswerCollectionName?: string | null
  entries: IElementImportPackagePreviewEntry[]
}
export const ElementImportPackagePreviewAnswerCollectionRef =
  builder.objectRef<IElementImportPackagePreviewAnswerCollection>(
    'ElementImportPackagePreviewAnswerCollection'
  )
export const ElementImportPackagePreviewAnswerCollection =
  ElementImportPackagePreviewAnswerCollectionRef.implement({
    fields: (t) => ({
      ref: t.exposeString('ref'),
      name: t.exposeString('name'),
      description: t.exposeString('description'),
      alreadyImported: t.exposeBoolean('alreadyImported'),
      existingAnswerCollectionId: t.exposeInt('existingAnswerCollectionId', {
        nullable: true,
      }),
      existingAnswerCollectionName: t.exposeString(
        'existingAnswerCollectionName',
        {
          nullable: true,
        }
      ),
      entries: t.expose('entries', {
        type: [ElementImportPackagePreviewEntry],
      }),
    }),
  })

export type IElementImportPackagePreviewElement =
  ElementImportPackagePreviewElementSource
export const ElementImportPackagePreviewElementRef =
  builder.objectRef<IElementImportPackagePreviewElement>(
    'ElementImportPackagePreviewElement'
  )
export const ElementImportPackagePreviewElement =
  ElementImportPackagePreviewElementRef.implement({
    fields: (t) => ({
      ref: t.exposeString('ref'),
      name: t.exposeString('name'),
      content: t.exposeString('content'),
      type: t.expose('type', { type: ElementType }),
      options: t.field({
        type: ElementImportPackagePreviewOptions,
        resolve: createElementImportPackagePreviewOptions,
      }),
      pointsMultiplier: t.exposeInt('pointsMultiplier'),
      basePoints: t.exposeBoolean('basePoints'),
      explanation: t.exposeString('explanation', { nullable: true }),
      status: t.expose('status', { type: ElementStatus }),
      alreadyImported: t.exposeBoolean('alreadyImported'),
      existingElementId: t.exposeInt('existingElementId', {
        nullable: true,
      }),
      existingElementName: t.exposeString('existingElementName', {
        nullable: true,
      }),
      answerCollectionId: t.exposeInt('answerCollectionId', {
        nullable: true,
      }),
      answerCollectionRef: t.exposeString('answerCollectionRef', {
        nullable: true,
      }),
      answerCollectionItemIds: t.field({
        type: ['Int'],
        resolve: (element) => element.answerCollectionItemIds,
      }),
    }),
  })

export interface IElementImportPackagePreview {
  importToken?: string | null
  elements: IElementImportPackagePreviewElement[]
  answerCollections: IElementImportPackagePreviewAnswerCollection[]
  warnings: ImportExportWarningCodeType[]
  errors: ImportExportErrorCodeType[]
}
export const ElementImportPackagePreviewRef =
  builder.objectRef<IElementImportPackagePreview>('ElementImportPackagePreview')
export const ElementImportPackagePreview =
  ElementImportPackagePreviewRef.implement({
    fields: (t) => ({
      importToken: t.exposeString('importToken', { nullable: true }),
      elements: t.expose('elements', {
        type: [ElementImportPackagePreviewElement],
      }),
      answerCollections: t.expose('answerCollections', {
        type: [ElementImportPackagePreviewAnswerCollection],
      }),
      warnings: t.expose('warnings', { type: [ImportExportWarningCode] }),
      errors: t.expose('errors', { type: [ImportExportErrorCode] }),
    }),
  })

export interface IElementImportPackageResult {
  importedElements: number
  importedAnswerCollections: number
  skippedElements: number
  warnings: ImportExportWarningCodeType[]
}
export const ElementImportPackageResultRef =
  builder.objectRef<IElementImportPackageResult>('ElementImportPackageResult')
export const ElementImportPackageResult =
  ElementImportPackageResultRef.implement({
    fields: (t) => ({
      importedElements: t.exposeInt('importedElements'),
      importedAnswerCollections: t.exposeInt('importedAnswerCollections'),
      skippedElements: t.exposeInt('skippedElements'),
      warnings: t.expose('warnings', { type: [ImportExportWarningCode] }),
    }),
  })

type ElementExportPackageArgs = { elementIds: number[] }
type ElementExportPackageContext = Parameters<
  typeof ElementImportExportService.getElementExportPackageLink
>[1]

export async function resolveElementExportPackageLinkAtBoundary(
  args: ElementExportPackageArgs,
  ctx: ElementExportPackageContext,
  service: typeof ElementImportExportService.getElementExportPackageLink = ElementImportExportService.getElementExportPackageLink
) {
  if (args.elementIds.length > MAX_IMPORT_EXPORT_ELEMENTS) {
    throw toImportExportGraphQLError(
      new ImportExportDomainError(ImportExportErrorCodeEnum.TOO_MANY_ELEMENTS)
    )
  }

  return await service(args, ctx)
}

export async function resolveElementExportPackagePreviewAtBoundary(
  args: ElementExportPackageArgs,
  ctx: ElementExportPackageContext,
  service: typeof ElementImportExportService.getElementExportPackagePreview = ElementImportExportService.getElementExportPackagePreview
) {
  if (args.elementIds.length > MAX_IMPORT_EXPORT_ELEMENTS) {
    return {
      elements: [],
      answerCollections: [],
      warnings: [],
      errors: [ImportExportErrorCodeEnum.TOO_MANY_ELEMENTS],
    } satisfies Awaited<ReturnType<typeof service>>
  }

  return await service(args, ctx)
}

type ImportElementPackageArgs = {
  importToken: string
  selectedElementRefs: string[]
}
type ImportElementPackageContext = Parameters<
  typeof ElementImportExportService.importElementPackage
>[1]

export async function resolveImportElementPackageAtBoundary(
  args: ImportElementPackageArgs,
  ctx: ImportElementPackageContext,
  service: typeof ElementImportExportService.importElementPackage = ElementImportExportService.importElementPackage
) {
  if (args.selectedElementRefs.length > MAX_IMPORT_EXPORT_ELEMENTS) {
    throw toImportExportGraphQLError(
      new ImportExportDomainError(ImportExportErrorCodeEnum.INVALID_SELECTION)
    )
  }

  return await service(args, ctx)
}

const asUser = { authenticated: true, role: DB.UserRole.USER }
const asUserFullAccess = {
  ...asUser,
  scope: DB.UserLoginScope.FULL_ACCESS,
}

builder.queryFields((t) => ({
  canUseElementImportExport: t.withAuth(asUser).field({
    type: 'Boolean',
    resolve: async (_, __, ctx) => {
      return await ImportExportAuthorizationService.getElementImportExportCapability(
        ctx
      )
    },
  }),

  getElementExportPackageLink: t.withAuth(asUserFullAccess).field({
    nullable: true,
    type: ElementExportPackageLink,
    args: {
      elementIds: t.arg.intList({ required: true }),
    },
    resolve: async (_, args, ctx) => {
      return await resolveElementExportPackageLinkAtBoundary(args, ctx)
    },
  }),

  getElementExportPackagePreview: t.withAuth(asUserFullAccess).field({
    nullable: true,
    type: ElementExportPackagePreview,
    args: {
      elementIds: t.arg.intList({ required: true }),
    },
    resolve: async (_, args, ctx) => {
      return await resolveElementExportPackagePreviewAtBoundary(args, ctx)
    },
  }),
}))

builder.mutationFields((t) => ({
  prepareElementImportPackageUpload: t.withAuth(asUserFullAccess).field({
    nullable: true,
    type: ElementImportPackageUpload,
    args: {
      filename: t.arg.string({ required: true }),
      bytes: t.arg.int({ required: true }),
    },
    resolve: async (_, args, ctx) => {
      return await ElementImportExportService.prepareElementImportPackageUpload(
        args,
        ctx
      )
    },
  }),

  validateElementImportPackage: t.withAuth(asUserFullAccess).field({
    nullable: true,
    type: ElementImportPackagePreview,
    args: {
      artifactId: t.arg.string({ required: true }),
    },
    resolve: async (_, args, ctx) => {
      return await ElementImportExportService.validateElementImportPackage(
        args,
        ctx
      )
    },
  }),

  importElementPackage: t.withAuth(asUserFullAccess).field({
    nullable: true,
    type: ElementImportPackageResult,
    args: {
      importToken: t.arg.string({ required: true }),
      selectedElementRefs: t.arg.stringList({ required: true }),
    },
    resolve: async (_, args, ctx) => {
      return await resolveImportElementPackageAtBoundary(args, ctx)
    },
  }),
}))
