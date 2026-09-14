import * as DB from '@klicker-uzh/prisma/client'
import { canonicalizeElementDomain } from '../lib/elementDomain.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import {
  computeAnswerCollectionDidacticFingerprint,
  computeElementDidacticFingerprint,
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  preparePlainTextFingerprintValues,
  type FingerprintMediaContext,
} from '../lib/importExportFingerprintCanonicalization.js'
import {
  collectAnswerCollectionMediaReferences,
  collectElementMediaReferences,
  isPackageMediaHref,
  rewriteAnswerCollectionMediaReferences,
  rewriteElementMediaReferences,
} from '../lib/importExportMediaReferences.js'
import type {
  PackageAnswerCollection,
  PackageElement,
  PackageMediaManifestEntry,
} from '../lib/importExportPackageContract.js'

type ImportExecutionMedia = Pick<
  PackageMediaManifestEntry,
  'sha256' | 'sourceHref'
>

export type ElementImportExecutionCollectionPlan = Readonly<{
  ref: string
  name: string
  description: string
  entries: readonly Readonly<{ ref: string; value: string }>[]
}>

type ElementImportExecutionElementPlanFor<Element extends PackageElement> =
  Element extends PackageElement
    ? Readonly<
        Omit<Element, 'answerCollectionItemRefs' | 'explanation'> & {
          originalId: string
          explanation: string | null
          answerCollectionItemRefs: readonly string[]
        }
      >
    : never

export type ElementImportExecutionElementPlan =
  ElementImportExecutionElementPlanFor<PackageElement>

export type ElementImportExecutionPlan = Readonly<{
  ownerId: string
  packageHash: string
  answerCollections: readonly ElementImportExecutionCollectionPlan[]
  elements: readonly ElementImportExecutionElementPlan[]
  media: readonly Readonly<ImportExecutionMedia>[]
}>

export type BoundElementImportExecutionCollectionPlan =
  ElementImportExecutionCollectionPlan &
    Readonly<{
      importFingerprint: string
      importFingerprintVersion: typeof IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION
    }>

export type BoundElementImportExecutionElementPlan =
  ElementImportExecutionElementPlan extends infer Element
    ? Element extends ElementImportExecutionElementPlan
      ? Element &
          Readonly<{
            importFingerprint: string
            importFingerprintVersion: typeof IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION
          }>
      : never
    : never

export type BoundElementImportExecutionPlan = Readonly<{
  ownerId: string
  packageHash: string
  answerCollections: readonly BoundElementImportExecutionCollectionPlan[]
  elements: readonly BoundElementImportExecutionElementPlan[]
}>

function infrastructureFailure(cause?: unknown): never {
  throw new ImportExportDomainError(
    ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
    cause
  )
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

function createImportedElementOriginalId(
  packageHash: string,
  elementRef: string
) {
  return `import-package:${packageHash.slice(0, 16)}:${elementRef}`
}

function createExecutionElementPlan<Element extends PackageElement>(
  element: Element,
  packageHash: string
) {
  return {
    ...element,
    originalId: createImportedElementOriginalId(packageHash, element.ref),
    explanation: element.explanation ?? null,
    answerCollectionItemRefs: element.answerCollectionItemRefs ?? [],
  }
}

function assertNoPackageMediaReferences({
  answerCollections,
  elements,
}: {
  answerCollections: readonly ElementImportExecutionCollectionPlan[]
  elements: readonly ElementImportExecutionElementPlan[]
}) {
  const references = [
    ...answerCollections.flatMap((collection) =>
      collectAnswerCollectionMediaReferences(collection)
    ),
    ...elements.flatMap((element) => collectElementMediaReferences(element)),
  ]

  if (references.some((reference) => isPackageMediaHref(reference.href))) {
    infrastructureFailure('Package media replacement is incomplete.')
  }
}

function assertCanonicalRefSpace({
  answerCollections,
  elements,
}: Pick<ElementImportExecutionPlan, 'answerCollections' | 'elements'>) {
  const collectionByRef = new Map(
    answerCollections.map((collection) => [collection.ref, collection])
  )
  if (collectionByRef.size !== answerCollections.length) infrastructureFailure()
  const entryCollectionByRef = new Map<string, string>()

  for (const collection of answerCollections) {
    if (entryCollectionByRef.has(collection.ref)) infrastructureFailure()

    for (const entry of collection.entries) {
      if (
        collectionByRef.has(entry.ref) ||
        entryCollectionByRef.has(entry.ref)
      ) {
        infrastructureFailure()
      }
      entryCollectionByRef.set(entry.ref, collection.ref)
    }
  }

  const elementRefs = new Set<string>()
  for (const element of elements) {
    if (
      collectionByRef.has(element.ref) ||
      entryCollectionByRef.has(element.ref) ||
      elementRefs.has(element.ref)
    ) {
      infrastructureFailure()
    }
    elementRefs.add(element.ref)
    const collection = element.answerCollectionRef
      ? collectionByRef.get(element.answerCollectionRef)
      : undefined
    if (
      element.type === DB.ElementType.SELECTION &&
      collection &&
      typeof element.options.numberOfInputs === 'number' &&
      element.options.numberOfInputs > collection.entries.length
    ) {
      infrastructureFailure('Selection input count exceeds its package pool.')
    }

    for (const entryRef of element.answerCollectionItemRefs) {
      if (
        !element.answerCollectionRef ||
        entryCollectionByRef.get(entryRef) !== element.answerCollectionRef
      ) {
        infrastructureFailure('Element relation escaped the package ref-space.')
      }
    }

    canonicalizeElementDomain({
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
              selectedIds: element.answerCollectionItemRefs,
              caseSolutionReferenceKey:
                element.type === DB.ElementType.CASE_STUDY
                  ? ('itemRef' as const)
                  : undefined,
            }
          : undefined,
    })
  }
}

export function createElementImportExecutionPlan({
  ownerId,
  packageHash,
  answerCollections,
  elements,
  media,
}: {
  ownerId: string
  packageHash: string
  answerCollections: readonly PackageAnswerCollection[]
  elements: readonly PackageElement[]
  media: readonly ImportExecutionMedia[]
}): ElementImportExecutionPlan {
  const plan: ElementImportExecutionPlan = {
    ownerId,
    packageHash,
    answerCollections: answerCollections.map((collection) => ({
      ref: collection.ref,
      name: collection.name,
      description: collection.description,
      entries: collection.entries.map((entry) => ({
        ref: entry.ref,
        value: entry.value,
      })),
    })),
    elements: elements.map((element) =>
      createExecutionElementPlan(element, packageHash)
    ),
    media: media.map((entry) => ({
      sourceHref: entry.sourceHref,
      sha256: entry.sha256,
    })),
  }

  assertCanonicalRefSpace(plan)
  return deepFreeze(plan)
}

export function bindStagedImportMedia(
  plan: ElementImportExecutionPlan,
  replacements: ReadonlyMap<string, string>
): BoundElementImportExecutionPlan {
  const answerCollections = plan.answerCollections.map((collection) =>
    rewriteAnswerCollectionMediaReferences(collection, replacements)
  )
  const elements = plan.elements.map((element) =>
    rewriteElementMediaReferences(element, replacements)
  )
  assertNoPackageMediaReferences({ answerCollections, elements })

  const verifiedByHref = new Map<string, { sha256: string }>()
  for (const media of plan.media) {
    const href = replacements.get(media.sourceHref)
    if (href) verifiedByHref.set(href, { sha256: media.sha256 })
  }
  const fingerprintMedia: FingerprintMediaContext = { verifiedByHref }
  const collectionByRef = new Map<
    string,
    {
      entryValueByRef: ReadonlyMap<string, string>
      preparedAnswerPoolValues: ReturnType<
        typeof preparePlainTextFingerprintValues
      >
    }
  >()

  const boundCollections = answerCollections.map((collection) => {
    const fingerprint = computeAnswerCollectionDidacticFingerprint({
      entries: collection.entries,
    })
    if (!fingerprint) {
      infrastructureFailure('Answer collection fingerprint binding failed.')
    }
    collectionByRef.set(collection.ref, {
      entryValueByRef: new Map(
        collection.entries.map((entry) => [entry.ref, entry.value])
      ),
      preparedAnswerPoolValues: preparePlainTextFingerprintValues(
        collection.entries.map((entry) => entry.value)
      ),
    })

    return {
      ...collection,
      importFingerprint: fingerprint.fingerprint,
      importFingerprintVersion: fingerprint.version,
    }
  })

  const boundElements = elements.map((element) => {
    const indexedCollection = element.answerCollectionRef
      ? collectionByRef.get(element.answerCollectionRef)
      : undefined
    const selectedAnswerValues = element.answerCollectionItemRefs.map(
      (ref) =>
        indexedCollection?.entryValueByRef.get(ref) ?? infrastructureFailure()
    )
    const fingerprint = computeElementDidacticFingerprint({
      type: element.type,
      content: element.content,
      explanation: element.explanation,
      options: element.options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      preparedAnswerPoolValues: indexedCollection?.preparedAnswerPoolValues,
      selectedAnswerValues,
      relationValueByRef: indexedCollection?.entryValueByRef,
      media: fingerprintMedia,
    })
    if (!fingerprint) {
      infrastructureFailure('Element fingerprint binding failed.')
    }

    return {
      ...element,
      importFingerprint: fingerprint.fingerprint,
      importFingerprintVersion: fingerprint.version,
    }
  })

  const boundPlan = {
    ownerId: plan.ownerId,
    packageHash: plan.packageHash,
    answerCollections: boundCollections,
    elements: boundElements,
  }
  assertCanonicalRefSpace(boundPlan)
  return deepFreeze(boundPlan)
}
