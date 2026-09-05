import * as DB from '@klicker-uzh/prisma/client'
import type { CaseStudyOptionsWithSolutionReference } from '../lib/elementDomain/caseStudy.js'
import {
  computeAnswerCollectionDidacticFingerprint,
  computeElementDidacticFingerprint,
  preparePlainTextFingerprintValues,
  type FingerprintMediaContext,
  type PreparedPlainTextFingerprintValues,
} from '../lib/importExportFingerprintCanonicalization.js'
import type {
  PackageAnswerCollection,
  PackageElement,
  PackageMediaManifestEntry,
} from '../lib/importExportPackageContract.js'

export type ElementImportPreviewEntry = {
  id: number
  value: string
}

type PackageElementByType<Type extends DB.ElementType> = Extract<
  PackageElement,
  { type: Type }
>

type PackageCaseStudyOptions = PackageElementByType<
  typeof DB.ElementType.CASE_STUDY
>['options']

export type ElementImportCaseStudyPreviewOptions =
  CaseStudyOptionsWithSolutionReference<
    PackageCaseStudyOptions,
    'itemId',
    number
  >

export type ElementImportPackagePreviewOptionsByElementType = {
  [Type in DB.ElementType]: Type extends typeof DB.ElementType.CASE_STUDY
    ? ElementImportCaseStudyPreviewOptions
    : PackageElementByType<Type>['options']
}

export type ElementImportPackagePreviewOptionsSource = {
  [Type in DB.ElementType]: {
    type: Type
    options: ElementImportPackagePreviewOptionsByElementType[Type]
  }
}[DB.ElementType]

type ElementImportPackagePreviewElementFields = {
  ref: string
  name: string
  content: string
  pointsMultiplier: number
  basePoints: boolean
  explanation?: string | null
  status: DB.ElementStatus
  alreadyImported: boolean
  existingElementId?: number | null
  existingElementName?: string | null
  answerCollectionId?: number | null
  answerCollectionRef?: string | null
  answerCollectionItemIds: number[]
}

export type ElementImportPackagePreviewElement =
  ElementImportPackagePreviewElementFields &
    ElementImportPackagePreviewOptionsSource

export type ElementImportPackagePreviewAnswerCollection = {
  ref: string
  name: string
  description: string
  alreadyImported: boolean
  existingAnswerCollectionId?: number | null
  existingAnswerCollectionName?: string | null
  entries: ElementImportPreviewEntry[]
}

export type ElementImportPackagePreview = {
  answerCollections: ElementImportPackagePreviewAnswerCollection[]
  elements: ElementImportPackagePreviewElement[]
}

export type ElementImportPreviewPackage = {
  answerCollections: readonly PackageAnswerCollection[]
  elements: readonly PackageElement[]
  media: readonly Pick<
    PackageMediaManifestEntry,
    'filename' | 'sha256' | 'sourceHref'
  >[]
}

export type ElementImportPackageDuplicateMatches = {
  elementMatchByFingerprint?: ReadonlyMap<string, { id: number; name: string }>
  answerCollectionMatchByFingerprint?: ReadonlyMap<
    string,
    { id: number; name: string }
  >
}

export type ElementImportPreviewOperationCounters = {
  modelBuilds: number
  collectionsIndexed: number
  entriesIndexed: number
  elementsBuilt: number
  collectionLookups: number
  selectedRefLookups: number
  caseSolutionRefLookups: number
  collectionFingerprintPasses: number
  elementFingerprintPasses: number
  duplicateOverlayVisits: number
}

export type ElementImportPreviewModel = {
  preview: ElementImportPackagePreview
  elementFingerprintCandidates: readonly (readonly string[])[]
  answerCollectionFingerprints: readonly (string | null)[]
}

type IndexedCollection = {
  ordinal: number
  preview: ElementImportPackagePreviewAnswerCollection
  entryByRef: ReadonlyMap<string, ElementImportPreviewEntry>
  entryValueByRef: ReadonlyMap<string, string>
  preparedAnswerPoolValues: PreparedPlainTextFingerprintValues | null
}

export function createElementImportPreviewOperationCounters(): ElementImportPreviewOperationCounters {
  return {
    modelBuilds: 0,
    collectionsIndexed: 0,
    entriesIndexed: 0,
    elementsBuilt: 0,
    collectionLookups: 0,
    selectedRefLookups: 0,
    caseSolutionRefLookups: 0,
    collectionFingerprintPasses: 0,
    elementFingerprintPasses: 0,
    duplicateOverlayVisits: 0,
  }
}

function increment(
  counters: ElementImportPreviewOperationCounters | undefined,
  key: keyof ElementImportPreviewOperationCounters,
  amount = 1
) {
  if (counters) counters[key] += amount
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry)
  } else {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry)
    }
  }

  return Object.freeze(value)
}

function mapCaseStudySolutionRefsToItemIds(
  options: PackageCaseStudyOptions,
  entryByRef: ReadonlyMap<string, ElementImportPreviewEntry>,
  counters?: ElementImportPreviewOperationCounters
): ElementImportCaseStudyPreviewOptions {
  const cloned = structuredClone(options)

  return {
    ...cloned,
    cases: cloned.cases.map((caseItem) => ({
      ...caseItem,
      solutions: caseItem.solutions?.map((solution) => {
        if (typeof solution.itemId !== 'undefined') {
          throw new Error(
            'Case study package must not contain database item IDs.'
          )
        }

        increment(counters, 'caseSolutionRefLookups')
        const entry =
          typeof solution.itemRef === 'string'
            ? entryByRef.get(solution.itemRef)
            : undefined

        if (!entry) {
          throw new Error('Case study solution references an unknown entry.')
        }

        const { itemId: _itemId, itemRef: _itemRef, ...rest } = solution
        void _itemId
        void _itemRef
        return {
          ...rest,
          itemId: entry.id,
        }
      }),
    })),
  }
}

function buildElementPreviewOptions({
  element,
  collection,
  counters,
}: {
  element: PackageElement
  collection: IndexedCollection | undefined
  counters?: ElementImportPreviewOperationCounters
}): ElementImportPackagePreviewOptionsSource {
  if (element.type === DB.ElementType.SELECTION) {
    if (!collection) {
      throw new Error(
        `Element "${element.name}" is missing its answer collection.`
      )
    }

    // The package schema has already canonicalized these didactic options.
    // Relation IDs are exposed separately on the preview DTO and must not be
    // copied into an authoring-only `correctAnswers` array just to strip them
    // again during validation.
    return { type: element.type, options: { ...element.options } }
  }

  if (element.type === DB.ElementType.CASE_STUDY) {
    if (!collection) {
      throw new Error(
        `Element "${element.name}" is missing its answer collection.`
      )
    }

    // The review renderer consumes database-shaped item IDs in case-study
    // solutions. Collection and selected IDs remain separate preview fields.
    return {
      type: element.type,
      options: mapCaseStudySolutionRefsToItemIds(
        element.options,
        collection.entryByRef,
        counters
      ),
    }
  }

  // Package parsing has already run the type-specific canonical schema.
  switch (element.type) {
    case DB.ElementType.SC:
      return { type: element.type, options: element.options }
    case DB.ElementType.MC:
      return { type: element.type, options: element.options }
    case DB.ElementType.KPRIM:
      return { type: element.type, options: element.options }
    case DB.ElementType.NUMERICAL:
      return { type: element.type, options: element.options }
    case DB.ElementType.FREE_TEXT:
      return { type: element.type, options: element.options }
    case DB.ElementType.CONTENT:
      return { type: element.type, options: element.options }
    case DB.ElementType.FLASHCARD:
      return { type: element.type, options: element.options }
  }
}

function buildFingerprintMedia(
  normalizedPackage: ElementImportPreviewPackage
): FingerprintMediaContext {
  return {
    verifiedByHref: new Map(
      normalizedPackage.media.map((media) => [
        media.sourceHref,
        { sha256: media.sha256, filename: media.filename },
      ])
    ),
  }
}

export function createElementImportPreviewModel(
  normalizedPackage: ElementImportPreviewPackage,
  counters?: ElementImportPreviewOperationCounters
): ElementImportPreviewModel {
  increment(counters, 'modelBuilds')

  let nextPreviewEntryId = 1
  const collectionByRef = new Map<string, IndexedCollection>()
  const answerCollectionFingerprints: Array<string | null> = []
  const fingerprintMedia = buildFingerprintMedia(normalizedPackage)

  for (const [
    collectionIndex,
    collection,
  ] of normalizedPackage.answerCollections.entries()) {
    increment(counters, 'collectionsIndexed')
    increment(counters, 'collectionFingerprintPasses')

    const entryByRef = new Map<string, ElementImportPreviewEntry>()
    const entryValueByRef = new Map<string, string>()
    const entries = collection.entries.map((entry) => {
      increment(counters, 'entriesIndexed')
      const previewEntry = deepFreeze({
        id: nextPreviewEntryId++,
        value: entry.value,
      })
      entryByRef.set(entry.ref, previewEntry)
      entryValueByRef.set(entry.ref, previewEntry.value)
      return previewEntry
    })
    const preparedAnswerPoolValues = preparePlainTextFingerprintValues(
      collection.entries.map(({ value }) => value)
    )
    const fingerprint = computeAnswerCollectionDidacticFingerprint({
      entries: collection.entries,
      preparedValues: preparedAnswerPoolValues,
      media: fingerprintMedia,
    })
    answerCollectionFingerprints.push(fingerprint?.fingerprint ?? null)

    const preview = deepFreeze({
      ref: collection.ref,
      name: collection.name,
      description: collection.description,
      alreadyImported: false,
      existingAnswerCollectionId: null,
      existingAnswerCollectionName: null,
      entries,
    })
    collectionByRef.set(collection.ref, {
      ordinal: collectionIndex + 1,
      preview,
      entryByRef,
      entryValueByRef,
      preparedAnswerPoolValues,
    })
  }

  const elementFingerprintCandidates: string[][] = []
  const elements = normalizedPackage.elements.map((element) => {
    increment(counters, 'elementsBuilt')
    const collection = element.answerCollectionRef
      ? (increment(counters, 'collectionLookups'),
        collectionByRef.get(element.answerCollectionRef))
      : undefined
    const answerCollectionItemIds: number[] = []
    const selectedAnswerValues: string[] = []
    for (const ref of element.answerCollectionItemRefs ?? []) {
      increment(counters, 'selectedRefLookups')
      const entry = collection?.entryByRef.get(ref)
      if (!entry) {
        throw new Error(
          `Element "${element.name}" references an unknown entry.`
        )
      }
      answerCollectionItemIds.push(entry.id)
      selectedAnswerValues.push(entry.value)
    }

    const previewOptions = buildElementPreviewOptions({
      element,
      collection,
      counters,
    })
    increment(counters, 'elementFingerprintPasses')
    const importedFingerprint = computeElementDidacticFingerprint({
      content: element.content,
      type: element.type,
      // Fingerprint the already-canonical package form directly. In
      // particular, case-study package solutions use itemRef and are resolved
      // through relationValueByRef without first cloning them to itemId form.
      options: element.options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      explanation: element.explanation ?? null,
      preparedAnswerPoolValues: collection?.preparedAnswerPoolValues,
      selectedAnswerValues,
      relationValueByRef: collection?.entryValueByRef,
      media: fingerprintMedia,
    })
    elementFingerprintCandidates.push(
      importedFingerprint ? [importedFingerprint.fingerprint] : []
    )

    return deepFreeze({
      ref: element.ref,
      name: element.name,
      content: element.content,
      ...previewOptions,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      explanation: element.explanation ?? null,
      status: DB.ElementStatus.REVIEW,
      alreadyImported: false,
      existingElementId: null,
      existingElementName: null,
      answerCollectionId: collection ? -collection.ordinal : null,
      answerCollectionRef: element.answerCollectionRef ?? null,
      answerCollectionItemIds,
    })
  })

  const preview = deepFreeze({
    answerCollections: Array.from(
      collectionByRef.values(),
      ({ preview }) => preview
    ),
    elements,
  })

  return deepFreeze({
    preview,
    elementFingerprintCandidates,
    answerCollectionFingerprints,
  })
}

export function decorateElementImportPreviewWithDuplicateMatches(
  model: ElementImportPreviewModel,
  duplicateMatches: ElementImportPackageDuplicateMatches,
  counters?: ElementImportPreviewOperationCounters
): ElementImportPackagePreview {
  const answerCollections = model.preview.answerCollections.map(
    (collection, index) => {
      increment(counters, 'duplicateOverlayVisits')
      const fingerprint = model.answerCollectionFingerprints[index]
      const existing = fingerprint
        ? (duplicateMatches.answerCollectionMatchByFingerprint?.get(
            fingerprint
          ) ?? null)
        : null

      return deepFreeze({
        ...collection,
        alreadyImported: existing !== null,
        existingAnswerCollectionId: existing?.id ?? null,
        existingAnswerCollectionName: existing?.name ?? null,
      })
    }
  )
  const elements = model.preview.elements.map((element, index) => {
    increment(counters, 'duplicateOverlayVisits')
    const existing = model.elementFingerprintCandidates[index]
      ?.map((fingerprint) =>
        duplicateMatches.elementMatchByFingerprint?.get(fingerprint)
      )
      .find((match) => typeof match !== 'undefined')

    return deepFreeze({
      ...element,
      alreadyImported: typeof existing !== 'undefined',
      existingElementId: existing?.id ?? null,
      existingElementName: existing?.name ?? null,
    })
  })

  return deepFreeze({ answerCollections, elements })
}
