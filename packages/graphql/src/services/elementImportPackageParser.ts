import * as DB from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  ElementDomainIssueCode,
  ElementDomainValidationError,
} from '../lib/elementDomain.js'
import {
  getImportExportErrorCode as getTypedImportExportErrorCode,
  ImportExportDomainError,
  ImportExportErrorCode,
  ImportExportWarningCode,
  toImportExportGraphQLError,
} from '../lib/importExportErrors.js'
import {
  collectAnswerCollectionMediaReferences,
  collectElementMediaReferences,
  createPackageMediaHref,
  isImportExportMediaReferenceWorkBounded,
  isPackageMediaHref,
  MediaReferenceKind,
  omitExternalAutoLoadingAnswerCollectionMediaReferences,
  omitExternalAutoLoadingElementMediaReferences,
} from '../lib/importExportMediaReferences.js'
import {
  IMPORT_EXPORT_PACKAGE_TYPE,
  IMPORT_EXPORT_PACKAGE_VERSION,
  MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
  MAX_IMPORT_EXPORT_ELEMENTS,
  MAX_IMPORT_EXPORT_JSON_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_FILES,
  MAX_IMPORT_EXPORT_OPTIONS_BYTES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
  MAX_IMPORT_EXPORT_WARNINGS,
} from '../lib/importExportPackageConfig.js'
import {
  answerCollectionSchema,
  elementSchema,
  manifestSchema,
  type PackageAnswerCollection,
  type PackageElement,
  type PackageManifest,
  type PackageMediaManifestEntry,
} from '../lib/importExportPackageContract.js'
import { InvalidZipError, parseZip } from '../lib/zip.js'
import { createElementImportPreviewModel } from './elementImportPreviewModel.js'
import { ImportExportRateLimitError } from './importExportRateLimit.js'
import { parseKlickerMediaUrl } from './mediaStorage.js'

const IMPORT_ERROR_INVALID_PACKAGE = ImportExportErrorCode.INVALID_PACKAGE
const IMPORT_ERROR_INVALID_OPTIONS = ImportExportErrorCode.INVALID_OPTIONS
const IMPORT_WARNING_STATUS_NORMALIZED =
  ImportExportWarningCode.STATUS_NORMALIZED
const IMPORT_WARNING_EXTERNAL_MEDIA = ImportExportWarningCode.EXTERNAL_MEDIA
const IMPORT_WARNING_INACCESSIBLE_MEDIA =
  ImportExportWarningCode.MEDIA_NOT_INCLUDED
const IMPORT_WARNING_UNUSED_MEDIA = ImportExportWarningCode.UNUSED_MEDIA
const ELEMENT_DOMAIN_ISSUE_CODES = new Set<string>(
  Object.values(ElementDomainIssueCode)
)

export type PackageMedia = PackageMediaManifestEntry & {
  data: Buffer
}

export type NormalizedImportPackage = {
  manifest: PackageManifest
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
  media: PackageMedia[]
}

function assertOptionsSize(options: unknown) {
  if (
    Buffer.byteLength(JSON.stringify(options), 'utf8') >
    MAX_IMPORT_EXPORT_OPTIONS_BYTES
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }
}

function assertUniqueRefs(refs: string[], label: string) {
  const seenRefs = new Set<string>()

  for (const ref of refs) {
    if (seenRefs.has(ref)) {
      throw invalidImportPackage(`${label} must be unique.`)
    }

    seenRefs.add(ref)
  }
}

function assertGloballyUniquePackageRefs({
  answerCollections,
  elements,
  media = [],
}: {
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
  media?: PackageMediaManifestEntry[]
}) {
  const refs = new Map<string, string>()

  function addRef(ref: string, label: string) {
    const existingLabel = refs.get(ref)
    if (existingLabel) {
      throw invalidImportPackage(
        `Package references must be globally unique. Reference ${ref} is used for ${existingLabel} and ${label}.`
      )
    }

    refs.set(ref, label)
  }

  for (const element of elements) {
    addRef(element.ref, 'element')
  }

  for (const collection of answerCollections) {
    addRef(collection.ref, 'answer collection')

    for (const entry of collection.entries) {
      addRef(entry.ref, 'answer collection entry')
    }
  }

  for (const mediaEntry of media) {
    addRef(mediaEntry.ref, 'media')
  }
}

function uniqueCodes<Code extends string>(codes: readonly Code[]) {
  return Array.from(new Set(codes))
}

function invalidImportPackage(cause?: unknown) {
  return new ImportExportDomainError(
    ImportExportErrorCode.INVALID_PACKAGE,
    cause
  )
}

function decodeAndParseJsonBuffer(buffer: Buffer) {
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return JSON.parse(json) as unknown
  } catch (error) {
    throw invalidImportPackage(error)
  }
}

function parseJsonBuffer<Schema extends z.ZodTypeAny>(
  buffer: Buffer,
  schema: Schema,
  _label: string,
  {
    aggregateArrayPath,
    byteLimitArrayPath,
    byteLimitField,
    onParsed,
  }: {
    aggregateArrayPath?: string
    byteLimitArrayPath?: string
    byteLimitField?: string
    onParsed?: (parsed: unknown) => void
  } = {}
): z.output<Schema> {
  if (buffer.length > MAX_IMPORT_EXPORT_JSON_BYTES) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }

  const parsed = decodeAndParseJsonBuffer(buffer)
  onParsed?.(parsed)
  const result = schema.safeParse(parsed)
  if (result.success) return result.data as z.output<Schema>

  if (
    byteLimitArrayPath &&
    byteLimitField &&
    result.error.issues.some(
      (entry) =>
        entry.code === z.ZodIssueCode.too_big &&
        entry.path[0] === byteLimitArrayPath &&
        typeof entry.path[1] === 'number' &&
        entry.path[2] === byteLimitField
    )
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }

  if (
    aggregateArrayPath &&
    result.error.issues.some(
      (entry) =>
        entry.code === z.ZodIssueCode.too_big &&
        entry.path[0] === aggregateArrayPath
    )
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.AGGREGATE_LIMIT)
  }

  const domainIssues = result.error.issues.flatMap((entry) =>
    ELEMENT_DOMAIN_ISSUE_CODES.has(entry.message)
      ? [
          {
            code: entry.message as ElementDomainIssueCode,
            path: entry.path,
          },
        ]
      : []
  )
  if (domainIssues.length > 0) {
    throw new ElementDomainValidationError(domainIssues)
  }

  throw invalidImportPackage(result.error)
}

function parseManifestBuffer(buffer: Buffer) {
  if (buffer.length > MAX_IMPORT_EXPORT_JSON_BYTES) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }

  const parsed = decodeAndParseJsonBuffer(buffer)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const type = Reflect.get(parsed, 'type')
    const version = Reflect.get(parsed, 'version')
    const hasType = Object.prototype.hasOwnProperty.call(parsed, 'type')
    const hasVersion = Object.prototype.hasOwnProperty.call(parsed, 'version')

    if (
      (hasType && type !== IMPORT_EXPORT_PACKAGE_TYPE) ||
      (hasVersion && version !== IMPORT_EXPORT_PACKAGE_VERSION)
    ) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.UNSUPPORTED_PACKAGE
      )
    }

    const elements = Reflect.get(parsed, 'elements')
    const answerCollections = Reflect.get(parsed, 'answerCollections')
    const media = Reflect.get(parsed, 'media')
    const warnings = Reflect.get(parsed, 'warnings')
    if (
      (Array.isArray(elements) &&
        elements.length > MAX_IMPORT_EXPORT_ELEMENTS) ||
      (Array.isArray(answerCollections) &&
        answerCollections.length > MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS) ||
      (Array.isArray(media) && media.length > MAX_IMPORT_EXPORT_MEDIA_FILES) ||
      (Array.isArray(warnings) && warnings.length > MAX_IMPORT_EXPORT_WARNINGS)
    ) {
      throw new ImportExportDomainError(ImportExportErrorCode.AGGREGATE_LIMIT)
    }
  }

  return parseJsonBuffer(buffer, manifestSchema, 'Import package manifest', {
    byteLimitArrayPath: 'media',
    byteLimitField: 'bytes',
  })
}

export function getImportPackageErrorCode(error: unknown) {
  if (error instanceof ElementDomainValidationError) {
    return IMPORT_ERROR_INVALID_OPTIONS
  }

  if (
    error instanceof ImportExportDomainError ||
    error instanceof ImportExportRateLimitError
  ) {
    return getTypedImportExportErrorCode(error, IMPORT_ERROR_INVALID_PACKAGE)
  }

  return ImportExportErrorCode.INFRASTRUCTURE_FAILURE
}

function toPublicElementDomainError(
  error: unknown,
  code: ImportExportErrorCode
) {
  if (error instanceof ElementDomainValidationError) {
    return toImportExportGraphQLError(new ImportExportDomainError(code, error))
  }
  return toImportExportGraphQLError(error)
}

export function toPublicExportError(error: unknown) {
  return toPublicElementDomainError(
    error,
    ImportExportErrorCode.ELEMENT_NOT_PORTABLE
  )
}

export function toPublicImportError(error: unknown) {
  return toPublicElementDomainError(
    error,
    ImportExportErrorCode.INVALID_OPTIONS
  )
}

export function hashBuffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function parseElementImportPackageInternal(
  buffer: Buffer,
  parseArchive: typeof parseZip = parseZip
): NormalizedImportPackage {
  if (buffer.length > MAX_IMPORT_EXPORT_PACKAGE_BYTES) {
    throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
  }

  const entries = parseArchive(buffer, {
    maxEntries:
      MAX_IMPORT_EXPORT_ELEMENTS +
      MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS +
      MAX_IMPORT_EXPORT_MEDIA_FILES +
      1,
    maxUncompressedBytes: MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  })
  const files = new Map<string, Buffer>()

  for (const entry of entries) {
    if (files.has(entry.path)) {
      throw invalidImportPackage('Import package contains duplicate files.')
    }
    files.set(entry.path, entry.data)
  }

  const manifestBuffer = files.get('manifest.json')
  if (!manifestBuffer) {
    if (
      Array.from(files.keys()).some((path) => path.endsWith('/manifest.json'))
    ) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.MANIFEST_NOT_AT_ROOT
      )
    }

    throw new ImportExportDomainError(ImportExportErrorCode.INVALID_PACKAGE)
  }

  const manifest = parseManifestBuffer(manifestBuffer)
  assertUniqueRefs(
    manifest.elements.map((element) => element.ref),
    'Element references'
  )
  assertUniqueRefs(
    manifest.answerCollections.map((collection) => collection.ref),
    'Answer collection references'
  )
  assertUniqueRefs(
    manifest.media.map((media) => media.ref),
    'Media references'
  )

  const expectedPaths = new Set(['manifest.json'])

  const answerCollections = manifest.answerCollections.map((entry) => {
    const file = files.get(entry.file)
    if (!file) {
      throw invalidImportPackage(
        'Import package is missing an answer collection file.'
      )
    }

    expectedPaths.add(entry.file)
    const collection = parseJsonBuffer(
      file,
      answerCollectionSchema,
      'Answer collection file',
      { aggregateArrayPath: 'entries' }
    )

    if (collection.ref !== entry.ref) {
      throw invalidImportPackage('Answer collection reference mismatch.')
    }

    return collection
  })

  if (
    answerCollections.reduce(
      (total, collection) => total + collection.entries.length,
      0
    ) > MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.AGGREGATE_LIMIT)
  }

  let totalRawSelectedItemCount = 0
  const elements = manifest.elements.map((entry) => {
    const file = files.get(entry.file)
    if (!file) {
      throw invalidImportPackage('Import package is missing an element file.')
    }

    expectedPaths.add(entry.file)
    const element = parseJsonBuffer(file, elementSchema, 'Element file', {
      aggregateArrayPath: 'answerCollectionItemRefs',
      onParsed(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return
        }
        const rawOptions = Reflect.get(parsed, 'options')
        if (typeof rawOptions !== 'undefined') {
          assertOptionsSize(rawOptions)
        }

        const rawSelectedItems = Reflect.get(parsed, 'answerCollectionItemRefs')
        if (!Array.isArray(rawSelectedItems)) return

        totalRawSelectedItemCount += rawSelectedItems.length
        if (
          totalRawSelectedItemCount >
          MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS
        ) {
          throw new ImportExportDomainError(
            ImportExportErrorCode.AGGREGATE_LIMIT
          )
        }
      },
    })

    if (
      element.ref !== entry.ref ||
      element.answerCollectionRef !== entry.answerCollectionRef
    ) {
      throw invalidImportPackage('Element reference mismatch.')
    }

    return element
  })
  if (
    elements.reduce(
      (total, element) =>
        total + (element.answerCollectionItemRefs?.length ?? 0),
      0
    ) > MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.AGGREGATE_LIMIT)
  }

  const media = manifest.media.map((entry) => {
    const file = files.get(entry.file)
    if (!file) {
      throw invalidImportPackage('Import package is missing a media file.')
    }

    if (file.length === 0) {
      throw invalidImportPackage('Import package media must not be empty.')
    }

    if (file.length > MAX_IMPORT_EXPORT_MEDIA_BYTES) {
      throw new ImportExportDomainError(ImportExportErrorCode.PACKAGE_TOO_LARGE)
    }

    if (file.length !== entry.bytes || hashBuffer(file) !== entry.sha256) {
      throw invalidImportPackage('Import package media checksum mismatch.')
    }

    expectedPaths.add(entry.file)
    return {
      ...entry,
      data: file,
    }
  })

  for (const path of files.keys()) {
    if (!expectedPaths.has(path)) {
      throw invalidImportPackage('Import package contains unexpected files.')
    }
  }

  validatePackageDependencies({ answerCollections, elements, media })

  return {
    manifest,
    answerCollections,
    elements,
    media,
  }
}

export function parseElementImportPackage(
  buffer: Buffer,
  parseArchive: typeof parseZip = parseZip
): NormalizedImportPackage {
  try {
    return parseElementImportPackageInternal(buffer, parseArchive)
  } catch (error) {
    if (error instanceof InvalidZipError) {
      throw invalidImportPackage(error)
    }
    throw error
  }
}

function validatePackageDependencies({
  answerCollections,
  elements,
  media,
}: {
  answerCollections: PackageAnswerCollection[]
  elements: PackageElement[]
  media: PackageMedia[]
}) {
  assertUniqueRefs(
    elements.map((element) => element.ref),
    'Element references'
  )
  assertUniqueRefs(
    answerCollections.map((collection) => collection.ref),
    'Answer collection references'
  )
  assertUniqueRefs(
    media.map((entry) => entry.sourceHref),
    'Media package references'
  )
  assertUniqueRefs(
    media.map((entry) => entry.file),
    'Media package files'
  )
  assertGloballyUniquePackageRefs({ answerCollections, elements, media })

  const totalEntries = answerCollections.reduce(
    (total, collection) => total + collection.entries.length,
    0
  )
  if (totalEntries > MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES) {
    throw new ImportExportDomainError(ImportExportErrorCode.AGGREGATE_LIMIT)
  }

  if (!isImportExportMediaReferenceWorkBounded(elements, answerCollections)) {
    throw new ImportExportDomainError(ImportExportErrorCode.AGGREGATE_LIMIT)
  }

  const declaredMediaHrefs = new Set(media.map((entry) => entry.sourceHref))
  const referencedPackageMediaHrefs = new Set(
    collectPackageMediaReferences({ elements, answerCollections })
      .map((reference) => reference.href)
      .filter(isPackageMediaHref)
  )
  for (const href of referencedPackageMediaHrefs) {
    if (!declaredMediaHrefs.has(href)) {
      throw invalidImportPackage('Element references undeclared package media.')
    }
  }

  const collectionRefs = new Set<string>()
  const entryRefsByCollectionRef = new Map<string, Set<string>>()
  const entryRefs = new Set<string>()

  for (const collection of answerCollections) {
    const values = new Set<string>()
    const refs = new Set<string>()

    collectionRefs.add(collection.ref)

    for (const entry of collection.entries) {
      if (values.has(entry.value) || refs.has(entry.ref)) {
        throw invalidImportPackage(
          'Answer collection contains duplicate entries.'
        )
      }

      if (entryRefs.has(entry.ref)) {
        throw invalidImportPackage(
          'Answer collection entry references must be unique.'
        )
      }

      values.add(entry.value)
      refs.add(entry.ref)
      entryRefs.add(entry.ref)
    }

    entryRefsByCollectionRef.set(collection.ref, refs)
  }

  for (const entry of media) {
    if (entry.sourceHref !== createPackageMediaHref(entry.ref)) {
      throw invalidImportPackage('Media package reference mismatch.')
    }
  }

  for (const element of elements) {
    assertOptionsSize(element.options)

    const requiresAnswerCollection =
      element.type === DB.ElementType.SELECTION ||
      element.type === DB.ElementType.CASE_STUDY

    if (requiresAnswerCollection && !element.answerCollectionRef) {
      throw invalidImportPackage(
        `Element "${element.name}" is missing an answer collection.`
      )
    }

    if (
      element.answerCollectionRef &&
      !collectionRefs.has(element.answerCollectionRef)
    ) {
      throw invalidImportPackage(
        `Element "${element.name}" references an unknown collection.`
      )
    }

    const collectionEntryRefs = element.answerCollectionRef
      ? entryRefsByCollectionRef.get(element.answerCollectionRef)
      : undefined

    if (
      element.type === DB.ElementType.SELECTION &&
      collectionEntryRefs &&
      typeof element.options.numberOfInputs === 'number' &&
      element.options.numberOfInputs > collectionEntryRefs.size
    ) {
      throw invalidImportPackage(
        `Element "${element.name}" requires more inputs than its answer collection provides.`
      )
    }

    for (const itemRef of getElementEntryRefs(element)) {
      if (!entryRefs.has(itemRef)) {
        throw invalidImportPackage(
          `Element "${element.name}" references an unknown entry.`
        )
      }
      if (!collectionEntryRefs?.has(itemRef)) {
        throw new ImportExportDomainError(ImportExportErrorCode.INVALID_OPTIONS)
      }
    }
  }
}

function* getElementEntryRefs(element: PackageElement) {
  // Uniqueness and relation-shape checks have already run in elementSchema.
  // Iterate the canonical refs directly here so the dependency pass does not
  // allocate another maximum-sized Set for every element.
  yield* element.answerCollectionItemRefs ?? []

  if (element.type !== DB.ElementType.CASE_STUDY) {
    return
  }

  for (const caseItem of element.options.cases) {
    for (const solution of caseItem.solutions ?? []) {
      if (typeof solution.itemId !== 'undefined') {
        throw invalidImportPackage(
          'Case study package must not contain database item IDs.'
        )
      }

      if (typeof solution.itemRef === 'string') {
        yield solution.itemRef
      }
    }
  }
}

export function collectPackageMediaReferences({
  elements,
  answerCollections,
}: {
  elements: Array<{
    type: DB.ElementType
    content: string
    explanation?: string | null
    options: unknown
  }>
  answerCollections: Array<{
    description: string
    entries: readonly { value: string }[]
  }>
}) {
  const references = new Map<string, MediaReferenceKind>()
  const groups = [
    ...elements.map((element) => collectElementMediaReferences(element)),
    ...answerCollections.map((collection) =>
      collectAnswerCollectionMediaReferences(collection)
    ),
  ]

  for (const group of groups) {
    for (const reference of group) {
      const previousKind = references.get(reference.href)
      if (!previousKind || reference.kind === MediaReferenceKind.AUTO_LOAD) {
        references.set(reference.href, reference.kind)
      }
    }
  }

  return Array.from(references, ([href, kind]) => ({ href, kind }))
}

export function buildImportWarnings(
  normalizedPackage: NormalizedImportPackage
) {
  // Manifest warnings remain accepted for package-version compatibility, but
  // they are untrusted input. Only server-derived warnings may affect logs or
  // user-visible recovery guidance.
  const warnings: ImportExportWarningCode[] = [IMPORT_WARNING_STATUS_NORMALIZED]

  const packagedUrls = new Set(
    normalizedPackage.media.map((media) => media.sourceHref)
  )
  const references = collectPackageMediaReferences({
    elements: normalizedPackage.elements,
    answerCollections: normalizedPackage.answerCollections,
  })
  const referencedPackageUrls = new Set(
    references
      .filter((reference) => isPackageMediaHref(reference.href))
      .map((reference) => reference.href)
  )
  if (
    normalizedPackage.media.some(
      (media) => !referencedPackageUrls.has(media.sourceHref)
    )
  ) {
    warnings.push(IMPORT_WARNING_UNUSED_MEDIA)
  }

  const unpackagedUrls = references
    .filter(
      (reference) =>
        reference.kind === MediaReferenceKind.AUTO_LOAD &&
        !packagedUrls.has(reference.href)
    )
    .map((reference) => reference.href)

  if (unpackagedUrls.some((url) => parseKlickerMediaUrl(url))) {
    warnings.push(IMPORT_WARNING_INACCESSIBLE_MEDIA)
  }

  if (unpackagedUrls.some((url) => !parseKlickerMediaUrl(url))) {
    warnings.push(IMPORT_WARNING_EXTERNAL_MEDIA)
  }

  return uniqueCodes(warnings)
}

export function validateElementImportPackageBuffer(
  buffer: Buffer,
  {
    parseArchive = parseZip,
  }: {
    parseArchive?: typeof parseZip
  } = {}
) {
  const normalizedPackage = parseElementImportPackage(buffer, parseArchive)
  const previewPackage = {
    ...normalizedPackage,
    elements: normalizedPackage.elements.map((element) =>
      omitExternalAutoLoadingElementMediaReferences(element)
    ),
    answerCollections: normalizedPackage.answerCollections.map((collection) =>
      omitExternalAutoLoadingAnswerCollectionMediaReferences(collection)
    ),
  }
  return {
    normalizedPackage,
    preview: createElementImportPreviewModel(previewPackage).preview,
    warnings: buildImportWarnings(normalizedPackage),
  }
}
