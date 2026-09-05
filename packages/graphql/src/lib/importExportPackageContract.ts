import * as DB from '@klicker-uzh/prisma/client'
import { z } from 'zod'
import {
  canonicalizeElementDomain,
  createCanonicalElementOptionsSchema,
  ElementDomainValidationError,
} from './elementDomain.js'
import { ImportExportWarningCode } from './importExportErrors.js'
import {
  createPackageMediaHref,
  PACKAGE_MEDIA_HREF_PREFIX,
} from './importExportMediaReferences.js'
import {
  IMPORT_EXPORT_PACKAGE_TYPE,
  IMPORT_EXPORT_PACKAGE_VERSION,
  MAX_ELEMENT_POINTS_MULTIPLIER,
  MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
  MAX_IMPORT_EXPORT_CONTENT_LENGTH,
  MAX_IMPORT_EXPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_EXPORT_ELEMENTS,
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_FILES,
  MAX_IMPORT_EXPORT_NAME_LENGTH,
  MAX_IMPORT_EXPORT_WARNINGS,
} from './importExportPackageConfig.js'
import { isSupportedMediaContentType } from './mediaContentTypes.js'

const MAX_PACKAGE_REF_LENGTH = 120
const MAX_PACKAGE_PATH_LENGTH = 255
const SVG_MEDIA_CONTENT_TYPE = 'image/svg+xml'
const RESERVED_PACKAGE_REFS = new Set(['__proto__', 'constructor', 'prototype'])

export function isSupportedPackageMediaContentType(contentType: string) {
  return (
    contentType !== SVG_MEDIA_CONTENT_TYPE &&
    isSupportedMediaContentType(contentType)
  )
}

export const packageRefSchema = z
  .string()
  .min(1)
  .max(MAX_PACKAGE_REF_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/)
  .refine((ref) => !RESERVED_PACKAGE_REFS.has(ref.toLowerCase()))

const packagePathSchema = z
  .string()
  .min(1)
  .max(MAX_PACKAGE_PATH_LENGTH)
  .regex(/^[A-Za-z0-9._/-]+$/)

const mediaFilenameSchema = z
  .string()
  .min(1)
  .max(MAX_IMPORT_EXPORT_NAME_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)

export function createPackageFilePath(
  folder: 'elements' | 'answer-collections' | 'media',
  ref: string
) {
  return folder === 'media' ? `${folder}/${ref}` : `${folder}/${ref}.json`
}

export const mediaManifestEntrySchema = z
  .object({
    ref: packageRefSchema,
    file: packagePathSchema,
    filename: mediaFilenameSchema,
    contentType: z
      .string()
      .min(1)
      .max(120)
      .refine(isSupportedPackageMediaContentType),
    bytes: z.number().int().positive().max(MAX_IMPORT_EXPORT_MEDIA_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceHref: z
      .string()
      .min(PACKAGE_MEDIA_HREF_PREFIX.length + 1)
      .max(PACKAGE_MEDIA_HREF_PREFIX.length + MAX_PACKAGE_REF_LENGTH),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.file !== createPackageFilePath('media', entry.filename)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['file'],
        message: 'MEDIA_FILE_PATH_MISMATCH',
      })
    }
    if (entry.sourceHref !== createPackageMediaHref(entry.ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceHref'],
        message: 'MEDIA_REFERENCE_MISMATCH',
      })
    }
  })

export const manifestSchema = z
  .object({
    type: z.literal(IMPORT_EXPORT_PACKAGE_TYPE),
    version: z.literal(IMPORT_EXPORT_PACKAGE_VERSION),
    createdAt: z.string().datetime(),
    elements: z
      .array(
        z
          .object({
            ref: packageRefSchema,
            file: packagePathSchema,
            answerCollectionRef: packageRefSchema.optional(),
          })
          .strict()
      )
      .min(1)
      .max(MAX_IMPORT_EXPORT_ELEMENTS),
    answerCollections: z
      .array(
        z
          .object({
            ref: packageRefSchema,
            file: packagePathSchema,
          })
          .strict()
      )
      .max(MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS),
    media: z.array(mediaManifestEntrySchema).max(MAX_IMPORT_EXPORT_MEDIA_FILES),
    warnings: z
      .array(z.nativeEnum(ImportExportWarningCode))
      .max(MAX_IMPORT_EXPORT_WARNINGS)
      .transform((warnings) => Array.from(new Set(warnings)))
      .optional(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const refs = new Set<string>()
    const files = new Set<string>()

    const addUnique = (value: string, path: (string | number)[]) => {
      if (refs.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: 'DUPLICATE_GLOBAL_REF',
        })
      }
      refs.add(value)
    }
    const addUniqueFile = (value: string, path: (string | number)[]) => {
      if (files.has(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: 'DUPLICATE_FILE_PATH',
        })
      }
      files.add(value)
    }

    manifest.elements.forEach((entry, index) => {
      addUnique(entry.ref, ['elements', index, 'ref'])
      addUniqueFile(entry.file, ['elements', index, 'file'])
      if (entry.file !== createPackageFilePath('elements', entry.ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['elements', index, 'file'],
          message: 'ELEMENT_FILE_PATH_MISMATCH',
        })
      }
    })

    manifest.answerCollections.forEach((entry, index) => {
      addUnique(entry.ref, ['answerCollections', index, 'ref'])
      addUniqueFile(entry.file, ['answerCollections', index, 'file'])
      if (
        entry.file !== createPackageFilePath('answer-collections', entry.ref)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answerCollections', index, 'file'],
          message: 'ANSWER_COLLECTION_FILE_PATH_MISMATCH',
        })
      }
    })

    manifest.media.forEach((entry, index) => {
      addUnique(entry.ref, ['media', index, 'ref'])
      addUniqueFile(entry.file, ['media', index, 'file'])
    })
  })

export const answerCollectionEntrySchema = z
  .object({
    ref: packageRefSchema,
    value: z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH),
  })
  .strict()

export const answerCollectionSchema = z
  .object({
    ref: packageRefSchema,
    name: z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH),
    description: z.string().max(MAX_IMPORT_EXPORT_DESCRIPTION_LENGTH),
    entries: z
      .array(answerCollectionEntrySchema)
      .min(1)
      .max(MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES),
  })
  .strict()

const commonElementShape = {
  ref: packageRefSchema,
  name: z.string().min(1).max(MAX_IMPORT_EXPORT_NAME_LENGTH),
  content: z.string().min(1).max(MAX_IMPORT_EXPORT_CONTENT_LENGTH),
  pointsMultiplier: z.number().int().min(1).max(MAX_ELEMENT_POINTS_MULTIPLIER),
  basePoints: z.boolean(),
  explanation: z
    .string()
    .max(MAX_IMPORT_EXPORT_CONTENT_LENGTH)
    .nullable()
    .optional(),
  answerCollectionRef: packageRefSchema.optional(),
  answerCollectionItemRefs: z
    .array(packageRefSchema)
    .max(MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES)
    .optional(),
}

function createPackageElementSchema<Type extends DB.ElementType>(
  type: Type,
  caseSolutionReferenceKey: 'itemId' | 'itemRef' = 'itemId'
) {
  return z
    .object({
      ...commonElementShape,
      type: z.literal(type),
      options: createCanonicalElementOptionsSchema(
        type,
        caseSolutionReferenceKey
      ),
    })
    .strict()
}

export const elementSchema = z
  .discriminatedUnion('type', [
    createPackageElementSchema(DB.ElementType.SC),
    createPackageElementSchema(DB.ElementType.MC),
    createPackageElementSchema(DB.ElementType.KPRIM),
    createPackageElementSchema(DB.ElementType.NUMERICAL),
    createPackageElementSchema(DB.ElementType.FREE_TEXT),
    createPackageElementSchema(DB.ElementType.SELECTION),
    createPackageElementSchema(DB.ElementType.CASE_STUDY, 'itemRef'),
    createPackageElementSchema(DB.ElementType.CONTENT),
    createPackageElementSchema(DB.ElementType.FLASHCARD),
  ])
  .transform((element, ctx) => {
    try {
      const usesAnswerCollection =
        element.type === DB.ElementType.SELECTION ||
        element.type === DB.ElementType.CASE_STUDY
      if (
        (usesAnswerCollection && !element.answerCollectionRef) ||
        (!usesAnswerCollection &&
          (typeof element.answerCollectionRef !== 'undefined' ||
            typeof element.answerCollectionItemRefs !== 'undefined')) ||
        (element.type === DB.ElementType.CASE_STUDY &&
          !element.answerCollectionItemRefs?.length)
      ) {
        throw new ElementDomainValidationError([
          { code: 'ELEMENT_INVALID_RELATION', path: ['relations'] },
        ])
      }

      const canonical = canonicalizeElementDomain({
        type: element.type,
        content: element.content,
        explanation: element.explanation,
        basePoints: element.basePoints,
        pointsMultiplier: element.pointsMultiplier,
        options: element.options,
        relations:
          element.type === DB.ElementType.SELECTION ||
          element.type === DB.ElementType.CASE_STUDY
            ? {
                answerCollectionId: element.answerCollectionRef,
                selectedIds: element.answerCollectionItemRefs ?? [],
                caseSolutionReferenceKey:
                  element.type === DB.ElementType.CASE_STUDY
                    ? ('itemRef' as const)
                    : undefined,
              }
            : undefined,
      })

      return {
        ...element,
        content: canonical.content,
        explanation: canonical.explanation,
        basePoints: canonical.basePoints,
        pointsMultiplier: canonical.pointsMultiplier,
        options: canonical.options,
        answerCollectionRef: usesAnswerCollection
          ? canonical.relations.answerCollectionId
          : undefined,
        answerCollectionItemRefs: usesAnswerCollection
          ? canonical.relations.selectedIds
          : undefined,
      } as typeof element
    } catch (error) {
      if (!(error instanceof ElementDomainValidationError)) throw error

      for (const issue of error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...issue.path],
          message: issue.code,
        })
      }
      return z.NEVER
    }
  })

export type PackageManifest = z.infer<typeof manifestSchema>
export type PackageMediaManifestEntry = z.infer<typeof mediaManifestEntrySchema>
export type PackageAnswerCollection = z.infer<typeof answerCollectionSchema>
export type PackageElement = z.infer<typeof elementSchema>
