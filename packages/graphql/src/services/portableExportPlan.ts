import * as DB from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  canonicalizeElementDomain,
  ElementDomainValidationError,
} from '../lib/elementDomain.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
  ImportExportWarningCode,
} from '../lib/importExportErrors.js'
import {
  collectAnswerCollectionMediaReferences,
  collectElementMediaReferences,
  createPackageMediaHref,
  isImportExportMediaReferenceWorkBounded,
  isPackageMediaHref,
  MediaReferenceKind,
  rewriteExportAnswerCollectionMediaReferences,
  rewriteExportElementMediaReferences,
} from '../lib/importExportMediaReferences.js'
import {
  IMPORT_EXPORT_PACKAGE_TYPE,
  IMPORT_EXPORT_PACKAGE_VERSION,
  MAX_IMPORT_EXPORT_JSON_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_FILES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
} from '../lib/importExportPackageConfig.js'
import {
  answerCollectionSchema,
  createPackageFilePath,
  elementSchema,
  isSupportedPackageMediaContentType,
  type PackageAnswerCollection,
  type PackageElement,
  type PackageManifest,
  type PackageMediaManifestEntry,
} from '../lib/importExportPackageContract.js'
import type {
  ElementExportSnapshot,
  ExportElementSnapshot,
} from './elementExportSnapshot.js'

export type PortableExportMediaHrefClassification = Readonly<{
  storageIdentity: string
}>

export type PortableExportMediaHrefClassifier = (
  href: string
) => PortableExportMediaHrefClassification | null

export type PortableExportMediaCandidate = Readonly<{
  storageIdentity: string
  href: string
  aliases: readonly string[]
}>

export type PortableExportMediaInventory = Readonly<{
  firstParty: readonly PortableExportMediaCandidate[]
  external: readonly Readonly<{ href: string }>[]
}>

export const PortableExportMediaOutcomeStatus = {
  INCLUDED: 'INCLUDED',
  OMITTED: 'OMITTED',
} as const

export type PortableExportMediaOutcome =
  | Readonly<{
      storageIdentity: string
      status: typeof PortableExportMediaOutcomeStatus.OMITTED
    }>
  | Readonly<{
      storageIdentity: string
      status: typeof PortableExportMediaOutcomeStatus.INCLUDED
      filename: string
      contentType: string
      bytes: number
      sha256: string
      data?: Buffer
    }>

export type PortableExportRenderedFile = Readonly<{
  path: string
  bytes: number
  data: Buffer | null
}>

export type RenderedPortableExportPackage = Readonly<{
  manifest: PackageManifest
  elementFiles: readonly Readonly<{
    sourceId: number
    path: string
    content: PackageElement
    bytes: number
    data: Buffer
  }>[]
  answerCollectionFiles: readonly Readonly<{
    sourceId: number
    path: string
    content: PackageAnswerCollection
    bytes: number
    data: Buffer
  }>[]
  mediaFiles: readonly Readonly<{
    storageIdentity: string
    path: string
    bytes: number
    data: Buffer | null
  }>[]
  files: readonly PortableExportRenderedFile[]
  warnings: readonly ImportExportWarningCode[]
  storedZipBytes: number
  exceedsPackageLimit: boolean
  isHydrated: boolean
}>

class ExportSourceContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportSourceContractError'
  }
}

export type PortableExportPlan = Readonly<{
  elements: readonly Readonly<{
    sourceId: number
    answerCollectionId: number | null
    manifest: PackageManifest['elements'][number]
    content: PackageElement
  }>[]
  answerCollections: readonly Readonly<{
    sourceId: number
    path: string
    content: PackageAnswerCollection
  }>[]
  mediaInventory: PortableExportMediaInventory
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function deepFreeze<Value>(value: Value): Value {
  if (
    !value ||
    typeof value !== 'object' ||
    ArrayBuffer.isView(value) ||
    Object.isFrozen(value)
  ) {
    return value
  }

  Object.freeze(value)
  for (const entry of Object.values(value)) deepFreeze(entry)
  return value
}

function defaultMediaHrefClassifier(): null {
  return null
}

function createPortableExportMediaInventory(
  elements: readonly PackageElement[],
  answerCollections: readonly PackageAnswerCollection[],
  classifyMediaHref: PortableExportMediaHrefClassifier
): PortableExportMediaInventory {
  const autoLoadingHrefs = new Set<string>()
  const referenceGroups = [
    ...elements.map((element) => collectElementMediaReferences(element)),
    ...answerCollections.map((collection) =>
      collectAnswerCollectionMediaReferences(collection)
    ),
  ]

  for (const references of referenceGroups) {
    for (const reference of references) {
      if (isPackageMediaHref(reference.href)) {
        throw new ExportSourceContractError(
          'Source content uses a reserved package transport reference.'
        )
      }
      if (reference.kind === MediaReferenceKind.AUTO_LOAD) {
        autoLoadingHrefs.add(reference.href)
      }
    }
  }

  const firstPartyByStorageIdentity = new Map<string, string[]>()
  const external: Array<{ href: string }> = []
  for (const href of Array.from(autoLoadingHrefs).sort()) {
    const classification = classifyMediaHref(href)
    if (!classification) {
      external.push({ href })
      continue
    }
    if (!classification.storageIdentity) {
      throw new ExportSourceContractError(
        'Media classifier returned an empty storage identity.'
      )
    }

    const aliases = firstPartyByStorageIdentity.get(
      classification.storageIdentity
    )
    if (aliases) aliases.push(href)
    else firstPartyByStorageIdentity.set(classification.storageIdentity, [href])
  }

  const firstParty = Array.from(firstPartyByStorageIdentity)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([storageIdentity, aliases]) => ({
      storageIdentity,
      href: aliases[0]!,
      aliases,
    }))

  return deepFreeze({ firstParty, external })
}

function mapCaseStudySolutionItemIdsToRefs(
  options: Record<string, unknown>,
  entryRefById: ReadonlyMap<number, string>
) {
  const cloned = structuredClone(options)
  if (!Array.isArray(cloned.cases)) return cloned

  cloned.cases = cloned.cases.map((caseItem) => {
    if (!isRecord(caseItem)) {
      throw new ExportSourceContractError(
        'Case study contains an invalid case definition.'
      )
    }
    if (typeof caseItem.solutions === 'undefined') return caseItem
    if (!Array.isArray(caseItem.solutions)) {
      throw new ExportSourceContractError(
        'Case study contains an invalid solution list.'
      )
    }

    return {
      ...caseItem,
      solutions: caseItem.solutions.map((solution) => {
        if (!isRecord(solution) || typeof solution.itemId !== 'number') {
          throw new ExportSourceContractError(
            'Case study solution does not reference a stored entry.'
          )
        }
        const itemRef = entryRefById.get(solution.itemId)
        if (!itemRef) {
          throw new ExportSourceContractError(
            'Case study solution references an unknown entry.'
          )
        }

        const { itemId: _itemId, ...rest } = solution
        return { ...rest, itemRef }
      }),
    }
  })

  return cloned
}

function canonicalizeSnapshotElement(
  element: ExportElementSnapshot,
  answerCollectionEntriesById: ReadonlyMap<number, readonly number[]>
) {
  const usesAnswerCollection =
    element.type === DB.ElementType.SELECTION ||
    element.type === DB.ElementType.CASE_STUDY
  const hasStoredAnswerCollectionRelation =
    typeof element.answerCollectionId === 'number' ||
    element.answerCollectionItems.length > 0
  const canonical = canonicalizeElementDomain({
    type: element.type,
    content: element.content,
    explanation: element.explanation,
    basePoints: element.basePoints,
    pointsMultiplier: element.pointsMultiplier,
    options: element.options,
    relations:
      usesAnswerCollection || hasStoredAnswerCollectionRelation
        ? {
            answerCollectionId: element.answerCollectionId ?? undefined,
            poolIds: element.answerCollectionId
              ? answerCollectionEntriesById.get(element.answerCollectionId)
              : undefined,
            selectedIds: element.answerCollectionItems.map(({ id }) => id),
            caseSolutionReferenceKey:
              element.type === DB.ElementType.CASE_STUDY
                ? ('itemId' as const)
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
  }
}

function asElementNotPortableError(error: unknown) {
  if (
    error instanceof ImportExportDomainError &&
    (error.code === ImportExportErrorCode.ELEMENT_NOT_PORTABLE ||
      error.code === ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT)
  ) {
    return error
  }
  if (
    error instanceof ElementDomainValidationError ||
    error instanceof z.ZodError ||
    error instanceof ExportSourceContractError
  ) {
    return new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
      error
    )
  }
  throw error
}

export function createPortableExportPlan(
  snapshot: ElementExportSnapshot,
  {
    classifyMediaHref = defaultMediaHrefClassifier,
  }: {
    classifyMediaHref?: PortableExportMediaHrefClassifier
  } = {}
): PortableExportPlan {
  try {
    const totalSelectedItemCount = snapshot.elements.reduce(
      (total, element) => total + element.answerCollectionItems.length,
      0
    )
    if (
      totalSelectedItemCount >
      MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS
    ) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
      )
    }

    const answerCollectionEntriesById = new Map(
      snapshot.answerCollections.map((collection) => [
        collection.id,
        collection.entries.map(({ id }) => id),
      ])
    )
    const canonicalElements = snapshot.elements.map((element) =>
      canonicalizeSnapshotElement(element, answerCollectionEntriesById)
    )
    const answerCollectionRefById = new Map(
      snapshot.answerCollections.map((collection, index) => [
        collection.id,
        `answer-collection-${index + 1}`,
      ])
    )
    const entryRefById = new Map<number, string>()
    const answerCollections = snapshot.answerCollections.map((collection) => {
      const ref = answerCollectionRefById.get(collection.id)!
      const content = answerCollectionSchema.parse({
        ref,
        name: collection.name,
        description: collection.description,
        entries: collection.entries.map((entry, index) => {
          const entryRef = `${ref}-entry-${index + 1}`
          entryRefById.set(entry.id, entryRef)
          return { ref: entryRef, value: entry.value }
        }),
      })
      return {
        sourceId: collection.id,
        path: createPackageFilePath('answer-collections', ref),
        content,
      }
    })

    const elements = canonicalElements.map((element, index) => {
      const ref = `element-${index + 1}`
      const usesAnswerCollection =
        element.type === DB.ElementType.SELECTION ||
        element.type === DB.ElementType.CASE_STUDY
      const answerCollectionRef = element.answerCollectionId
        ? answerCollectionRefById.get(element.answerCollectionId)
        : undefined
      if (usesAnswerCollection && !answerCollectionRef) {
        throw new ExportSourceContractError(
          'Element references an unknown answer collection.'
        )
      }
      const answerCollectionItemRefs = usesAnswerCollection
        ? element.answerCollectionItems.map(({ id }) => {
            const itemRef = entryRefById.get(id)
            if (!itemRef) {
              throw new ExportSourceContractError(
                'Element references an unknown answer collection entry.'
              )
            }
            return itemRef
          })
        : undefined
      const content = elementSchema.parse({
        ref,
        name: element.name,
        content: element.content,
        type: element.type,
        options:
          element.type === DB.ElementType.CASE_STUDY
            ? mapCaseStudySolutionItemIdsToRefs(element.options, entryRefById)
            : structuredClone(element.options),
        pointsMultiplier: element.pointsMultiplier,
        basePoints: element.basePoints,
        explanation: element.explanation,
        answerCollectionRef,
        answerCollectionItemRefs,
      })

      return {
        sourceId: element.id,
        answerCollectionId: element.answerCollectionId,
        manifest: {
          ref,
          file: createPackageFilePath('elements', ref),
          answerCollectionRef,
        },
        content,
      }
    })

    if (
      !isImportExportMediaReferenceWorkBounded(
        elements.map(({ content }) => content),
        answerCollections.map(({ content }) => content)
      )
    ) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT
      )
    }

    return deepFreeze({
      elements,
      answerCollections,
      mediaInventory: createPortableExportMediaInventory(
        elements.map(({ content }) => content),
        answerCollections.map(({ content }) => content),
        classifyMediaHref
      ),
    })
  } catch (error) {
    throw asElementNotPortableError(error)
  }
}

export function createPortableExportManifest({
  plan,
  media,
  warnings,
  createdAt,
}: {
  plan: PortableExportPlan
  media: readonly PackageMediaManifestEntry[]
  warnings: readonly ImportExportWarningCode[]
  createdAt: string
}): PackageManifest {
  return {
    type: IMPORT_EXPORT_PACKAGE_TYPE,
    version: IMPORT_EXPORT_PACKAGE_VERSION,
    createdAt,
    elements: plan.elements.map(({ manifest }) => ({ ...manifest })),
    answerCollections: plan.answerCollections.map(({ content, path }) => ({
      ref: content.ref,
      file: path,
    })),
    media: media.map((entry) => ({ ...entry })),
    warnings: [...warnings],
  }
}

function sanitizeMediaFilename(filename: string) {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return sanitized || 'media.bin'
}

function createAnonymousMediaFilename(index: number, filename: string) {
  const sanitized = sanitizeMediaFilename(filename)
  const extension = sanitized.match(/\.([a-z0-9]{1,12})$/)?.[1]
  return `media-${index}.${extension ?? 'bin'}`
}

function hashMedia(data: Buffer) {
  return createHash('sha256').update(data).digest('hex')
}

function createJsonFile(path: string, value: unknown, label: string) {
  const data = Buffer.from(JSON.stringify(value, null, 2), 'utf8')
  if (data.length > MAX_IMPORT_EXPORT_JSON_BYTES) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
      new ExportSourceContractError(`${label} is too large.`)
    )
  }

  return { path, bytes: data.length, data }
}

export function getStoredZipByteLength(
  files: readonly Readonly<{ path: string; bytes: number }>[]
) {
  let bytes = 22
  for (const file of files) {
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new ExportSourceContractError('Archive file size is invalid.')
    }
    bytes += getStoredZipEntryByteLength(file)
    if (!Number.isSafeInteger(bytes)) {
      throw new ExportSourceContractError('Archive size is invalid.')
    }
  }
  return bytes
}

function getStoredZipEntryByteLength(
  file: Readonly<{ path: string; bytes: number }>
) {
  if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) {
    throw new ExportSourceContractError('Archive file size is invalid.')
  }
  const pathBytes = Buffer.byteLength(file.path, 'utf8')
  return 30 + pathBytes + file.bytes + 46 + pathBytes
}

function indexMediaOutcomes(
  plan: PortableExportPlan,
  outcomes: readonly PortableExportMediaOutcome[]
) {
  const candidateIdentities = new Set(
    plan.mediaInventory.firstParty.map(({ storageIdentity }) => storageIdentity)
  )
  const outcomeByStorageIdentity = new Map<string, PortableExportMediaOutcome>()

  for (const outcome of outcomes) {
    if (
      !candidateIdentities.has(outcome.storageIdentity) ||
      outcomeByStorageIdentity.has(outcome.storageIdentity)
    ) {
      throw new ExportSourceContractError(
        'Media outcome does not match the portable export inventory.'
      )
    }
    outcomeByStorageIdentity.set(outcome.storageIdentity, outcome)
  }

  return outcomeByStorageIdentity
}

function validateIncludedMediaOutcome(
  outcome: Extract<
    PortableExportMediaOutcome,
    { status: typeof PortableExportMediaOutcomeStatus.INCLUDED }
  >
) {
  if (
    !Number.isSafeInteger(outcome.bytes) ||
    outcome.bytes < 0 ||
    outcome.bytes > MAX_IMPORT_EXPORT_MEDIA_BYTES ||
    outcome.contentType.length > 120 ||
    !isSupportedPackageMediaContentType(outcome.contentType)
  ) {
    throw new ExportSourceContractError('Included media metadata is invalid.')
  }
  if (outcome.data && outcome.data.length !== outcome.bytes) {
    throw new ExportSourceContractError(
      'Included media bytes do not match their declaration.'
    )
  }

  const computedSha256 = outcome.data ? hashMedia(outcome.data) : undefined
  if (
    !/^[a-f0-9]{64}$/.test(outcome.sha256) ||
    (computedSha256 && outcome.sha256 !== computedSha256)
  ) {
    throw new ExportSourceContractError(
      'Included media checksum does not match its declaration.'
    )
  }

  return outcome.sha256
}

export function getPortableExportPlanWarnings(plan: PortableExportPlan) {
  return plan.mediaInventory.external.length > 0
    ? ([ImportExportWarningCode.EXTERNAL_MEDIA] as const)
    : ([] as const)
}

/**
 * Hydrates the immutable portable plan with either preview metadata or final
 * downloaded bytes. Both callers therefore derive package JSON, omissions,
 * paths, warnings, and stored-ZIP accounting from the same pure operation.
 */
export function renderPortableExportPackage({
  plan,
  mediaOutcomes,
  createdAt,
}: {
  plan: PortableExportPlan
  mediaOutcomes: readonly PortableExportMediaOutcome[]
  createdAt: string
}): RenderedPortableExportPackage {
  if (plan.mediaInventory.firstParty.length > MAX_IMPORT_EXPORT_MEDIA_FILES) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
    )
  }
  const outcomeByStorageIdentity = indexMediaOutcomes(plan, mediaOutcomes)
  const warnings: ImportExportWarningCode[] = [
    ...getPortableExportPlanWarnings(plan),
  ]

  const replacements = new Map<string, string>()
  const media: PackageMediaManifestEntry[] = []
  const mediaFiles: Array<{
    storageIdentity: string
    path: string
    bytes: number
    data: Buffer | null
  }> = []
  let omittedFirstPartyMedia = false

  for (const candidate of plan.mediaInventory.firstParty) {
    const outcome = outcomeByStorageIdentity.get(candidate.storageIdentity)
    if (
      !outcome ||
      outcome.status === PortableExportMediaOutcomeStatus.OMITTED
    ) {
      omittedFirstPartyMedia = true
      continue
    }

    const sha256 = validateIncludedMediaOutcome(outcome)
    const index = media.length + 1
    const ref = `media-${index}`
    const filename = createAnonymousMediaFilename(index, outcome.filename)
    const path = createPackageFilePath('media', filename)
    const sourceHref = createPackageMediaHref(ref)
    media.push({
      ref,
      file: path,
      filename,
      contentType: outcome.contentType,
      bytes: outcome.bytes,
      sha256,
      sourceHref,
    })
    mediaFiles.push({
      storageIdentity: candidate.storageIdentity,
      path,
      bytes: outcome.bytes,
      data: outcome.data ?? null,
    })
    for (const alias of candidate.aliases) replacements.set(alias, sourceHref)
  }

  if (omittedFirstPartyMedia) {
    warnings.push(ImportExportWarningCode.MEDIA_NOT_INCLUDED)
  }

  const manifest = createPortableExportManifest({
    plan,
    media,
    warnings,
    createdAt,
  })
  const manifestFile = createJsonFile(
    'manifest.json',
    manifest,
    'Export package manifest'
  )
  const files: PortableExportRenderedFile[] = []
  let storedZipBytes = 22
  const appendFile = (file: PortableExportRenderedFile) => {
    storedZipBytes += getStoredZipEntryByteLength(file)
    if (storedZipBytes > MAX_IMPORT_EXPORT_PACKAGE_BYTES) {
      throw new ImportExportDomainError(
        ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE
      )
    }
    files.push(file)
  }
  appendFile(manifestFile)

  const answerCollectionFiles: Array<
    RenderedPortableExportPackage['answerCollectionFiles'][number]
  > = []
  for (const collection of plan.answerCollections) {
    const content = rewriteExportAnswerCollectionMediaReferences(
      collection.content,
      replacements
    )
    const file = {
      sourceId: collection.sourceId,
      content,
      ...createJsonFile(
        collection.path,
        content,
        'Answer collection export file'
      ),
    }
    answerCollectionFiles.push(file)
    appendFile(file)
  }

  const elementFiles: Array<
    RenderedPortableExportPackage['elementFiles'][number]
  > = []
  for (const element of plan.elements) {
    const content = rewriteExportElementMediaReferences(
      element.content,
      replacements
    )
    const file = {
      sourceId: element.sourceId,
      content,
      ...createJsonFile(element.manifest.file, content, 'Element export file'),
    }
    elementFiles.push(file)
    appendFile(file)
  }

  for (const mediaFile of mediaFiles) appendFile(mediaFile)

  return deepFreeze({
    manifest,
    elementFiles,
    answerCollectionFiles,
    mediaFiles,
    files,
    warnings,
    storedZipBytes,
    exceedsPackageLimit: false,
    isHydrated: mediaFiles.every(({ data }) => data !== null),
  })
}
