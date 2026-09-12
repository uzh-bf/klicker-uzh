import { ElementType } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { canonicalizeElementSharedFields } from './elementDomain.js'
import {
  collectElementMediaReferences,
  collectPlainTextMediaReferences,
  isPackageMediaHref,
  MediaReferenceKind,
  rewriteExportElementMediaReferences,
} from './importExportMediaReferences.js'

export const IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION = 2 as const
export const IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION = 1 as const

/**
 * @deprecated Fingerprint v2 uses the package export omission marker. This
 * legacy sentinel remains accepted as authored image input during migration.
 */
export const OMITTED_AUTO_LOAD_MEDIA_IDENTITY =
  'klicker-fingerprint-media:omitted'

const SHA256_PATTERN = /^[a-f0-9]{64}$/

type JsonRecord = Record<string, unknown>

export type VerifiedFingerprintMedia = {
  sha256: string
  // Accepted at the boundary to make the exclusion explicit. It is never hashed.
  filename?: string | null
}

export type FingerprintMediaContext = {
  verifiedByHref?: ReadonlyMap<string, VerifiedFingerprintMedia>
}

export type PreparedPlainTextFingerprintValues = Readonly<{
  values: readonly string[]
}>

export type AnswerCollectionDidacticFingerprintInput = {
  entries: readonly { value: string }[]
  preparedValues?: PreparedPlainTextFingerprintValues | null
  media?: FingerprintMediaContext
}

export type ElementDidacticFingerprintInput = {
  type: ElementType
  content: string
  explanation?: string | null
  options: JsonRecord
  pointsMultiplier: number
  basePoints: boolean
  answerPoolValues?: readonly string[] | null
  preparedAnswerPoolValues?: PreparedPlainTextFingerprintValues | null
  selectedAnswerValues?: readonly string[] | null
  relationValueById?: ReadonlyMap<number, string>
  relationValueByRef?: ReadonlyMap<string, string>
  media?: FingerprintMediaContext
}

export type VersionedDidacticFingerprint = {
  version: typeof IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION
  fingerprint: string
}

function compareStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .filter(([, entryValue]) => typeof entryValue !== 'undefined')
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)])
    )
  }

  return value
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

function normalizeSemanticSet(values: readonly unknown[]) {
  const valueByIdentity = new Map<string, unknown>()
  for (const value of values) {
    valueByIdentity.set(stableJson(value), value)
  }

  return Array.from(valueByIdentity.entries())
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, value]) => value)
}

function createVersionedFingerprint(
  kind: 'answer-collection' | 'element',
  payload: unknown
): VersionedDidacticFingerprint {
  const fingerprint = createHash('sha256')
    .update(
      stableJson({
        kind,
        version: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
        payload,
      })
    )
    .digest('hex')

  return {
    version: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
    fingerprint,
  }
}

export function createVerifiedMediaFingerprintIdentity(sha256: string) {
  if (!SHA256_PATTERN.test(sha256)) return null
  return `klicker-fingerprint-media:sha256:${sha256}`
}

function getVerifiedMediaIdentity(
  href: string,
  media: FingerprintMediaContext | undefined
) {
  const verified = media?.verifiedByHref?.get(href)
  return verified
    ? createVerifiedMediaFingerprintIdentity(verified.sha256)
    : undefined
}

function normalizePlainTextValues(values: readonly string[]) {
  for (const value of values) {
    for (const reference of collectPlainTextMediaReferences(value)) {
      // Answer-pool values are plain text. Their links are authored content,
      // never auto-loading media identity. Package-local transport refs cannot
      // become part of a stable fingerprint.
      if (isPackageMediaHref(reference.href)) return null
    }
  }

  return Object.freeze([...values].sort(compareStrings))
}

/**
 * Prepares the exact canonical value array used by fingerprint version 2.
 * Reusing this result avoids rescanning and resorting a shared answer pool for
 * every linked element without changing the hashed payload.
 */
export function preparePlainTextFingerprintValues(
  values: readonly string[]
): PreparedPlainTextFingerprintValues | null {
  const normalized = normalizePlainTextValues(values)
  return normalized ? Object.freeze({ values: normalized }) : null
}

function normalizeElementMedia(
  element: Pick<
    ElementDidacticFingerprintInput,
    'type' | 'content' | 'explanation'
  > & {
    options: JsonRecord
  },
  media: FingerprintMediaContext | undefined
) {
  const replacements = new Map<string, string>()

  for (const reference of collectElementMediaReferences(element)) {
    if (reference.kind !== MediaReferenceKind.AUTO_LOAD) {
      // User-activated links remain authored content even when they point at a
      // verified blob. A package-local ref is transport wiring, so decline to
      // fingerprint that malformed/non-portable link rather than hashing it.
      if (isPackageMediaHref(reference.href)) return null
      continue
    }

    const verifiedIdentity = getVerifiedMediaIdentity(reference.href, media)
    if (verifiedIdentity) {
      replacements.set(reference.href, verifiedIdentity)
      continue
    }

    // A package-local image without a valid verified hash is malformed package
    // transport and must still fail strict package-domain validation.
    if (isPackageMediaHref(reference.href)) {
      return null
    }

    // External, unsupported, unavailable, or invalidly classified persisted
    // images are omitted exactly as they are during package export. Leaving
    // them out of the replacement map makes the export rewriter emit the
    // deterministic omission marker while retaining any ordinary link that
    // happens to use the same href.
  }

  return rewriteExportElementMediaReferences(element, replacements)
}

function normalizePersistedElementMedia(
  element: Pick<
    ElementDidacticFingerprintInput,
    'type' | 'content' | 'explanation'
  > & {
    options: JsonRecord
  },
  media: FingerprintMediaContext | undefined
) {
  const replacements = new Map<string, string>()

  for (const reference of collectElementMediaReferences(element)) {
    if (reference.kind !== MediaReferenceKind.AUTO_LOAD) continue

    const verifiedIdentity = getVerifiedMediaIdentity(reference.href, media)
    if (verifiedIdentity) replacements.set(reference.href, verifiedIdentity)
  }

  return rewriteExportElementMediaReferences(element, replacements)
}

function getCaseStudyItemValue(
  solution: JsonRecord,
  input: ElementDidacticFingerprintInput
) {
  if (typeof solution.itemId === 'number') {
    return input.relationValueById?.get(solution.itemId) ?? null
  }

  if (typeof solution.itemRef === 'string') {
    return input.relationValueByRef?.get(solution.itemRef) ?? null
  }

  return null
}

function normalizeCaseStudyOptions(
  options: JsonRecord,
  input: ElementDidacticFingerprintInput
) {
  if (!Array.isArray(options.criteria) || !Array.isArray(options.cases)) {
    return null
  }

  const criterionOrderById = new Map<string, number>()
  const criteria: JsonRecord[] = []

  for (const [index, value] of options.criteria.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const { id, ...criterion } = value as JsonRecord
    if (typeof id !== 'string' || criterionOrderById.has(id)) return null

    criterionOrderById.set(id, index)
    criteria.push(criterion)
  }

  const cases: JsonRecord[] = []
  for (const value of options.cases) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const {
      id: _caseId,
      solutions: rawSolutions,
      ...caseItem
    } = value as JsonRecord
    void _caseId

    if (typeof rawSolutions === 'undefined') {
      cases.push(caseItem)
      continue
    }
    if (!Array.isArray(rawSolutions)) return null

    const solutions: JsonRecord[] = []
    for (const rawSolution of rawSolutions) {
      if (
        !rawSolution ||
        typeof rawSolution !== 'object' ||
        Array.isArray(rawSolution)
      ) {
        return null
      }

      const solution = rawSolution as JsonRecord
      const itemValue = getCaseStudyItemValue(solution, input)
      if (itemValue === null || !Array.isArray(solution.criteriaSolutions)) {
        return null
      }

      const criteriaSolutions: Array<{
        order: number
        value: JsonRecord
      }> = []
      for (const rawCriterionSolution of solution.criteriaSolutions) {
        if (
          !rawCriterionSolution ||
          typeof rawCriterionSolution !== 'object' ||
          Array.isArray(rawCriterionSolution)
        ) {
          return null
        }

        const { criterionId, ...criterionSolution } =
          rawCriterionSolution as JsonRecord
        const order =
          typeof criterionId === 'string'
            ? criterionOrderById.get(criterionId)
            : undefined
        if (typeof order === 'undefined') return null
        criteriaSolutions.push({ order, value: criterionSolution })
      }

      const { itemId: _itemId, itemRef: _itemRef, ...solutionFields } = solution
      void _itemId
      void _itemRef
      solutions.push({
        ...solutionFields,
        itemValue,
        criteriaSolutions: criteriaSolutions
          .sort((left, right) => left.order - right.order)
          .map((entry) => entry.value),
      })
    }

    cases.push({
      ...caseItem,
      solutions: solutions.sort((left, right) =>
        compareStrings(left.itemValue as string, right.itemValue as string)
      ),
    })
  }

  const {
    answerCollection: _answerCollection,
    answerCollectionId: _answerCollectionId,
    answerCollectionRef: _answerCollectionRef,
    collectionItemIds: _collectionItemIds,
    collectionItemRefs: _collectionItemRefs,
    criteria: _criteria,
    cases: _cases,
    ...rest
  } = options
  void _answerCollection
  void _answerCollectionId
  void _answerCollectionRef
  void _collectionItemIds
  void _collectionItemRefs
  void _criteria
  void _cases

  return { ...rest, criteria, cases }
}

function normalizeElementOptions(input: ElementDidacticFingerprintInput) {
  if (input.type === ElementType.SELECTION) {
    const {
      answerCollection: _answerCollection,
      answerCollectionId: _answerCollectionId,
      answerCollectionRef: _answerCollectionRef,
      correctAnswers: _correctAnswers,
      ...options
    } = input.options
    void _answerCollection
    void _answerCollectionId
    void _answerCollectionRef
    void _correctAnswers
    return options
  }

  if (input.type === ElementType.CASE_STUDY) {
    return normalizeCaseStudyOptions(input.options, input)
  }

  if (input.type === ElementType.NUMERICAL) {
    return {
      ...input.options,
      solutionRanges: Array.isArray(input.options.solutionRanges)
        ? normalizeSemanticSet(input.options.solutionRanges)
        : input.options.solutionRanges,
      exactSolutions: Array.isArray(input.options.exactSolutions)
        ? normalizeSemanticSet(input.options.exactSolutions)
        : input.options.exactSolutions,
    }
  }

  if (input.type === ElementType.FREE_TEXT) {
    return {
      ...input.options,
      solutions: Array.isArray(input.options.solutions)
        ? normalizeSemanticSet(input.options.solutions)
        : input.options.solutions,
    }
  }

  return input.options
}

export function computeAnswerCollectionDidacticFingerprint(
  input: AnswerCollectionDidacticFingerprintInput
): VersionedDidacticFingerprint | null {
  const values =
    typeof input.preparedValues === 'undefined'
      ? normalizePlainTextValues(input.entries.map((entry) => entry.value))
      : (input.preparedValues?.values ?? null)
  if (!values) return null

  return createVersionedFingerprint('answer-collection', { values })
}

export function computeElementDidacticFingerprint(
  input: ElementDidacticFingerprintInput
): VersionedDidacticFingerprint | null {
  const shared = canonicalizeElementSharedFields({
    type: input.type,
    content: input.content,
    explanation: input.explanation,
    basePoints: input.basePoints,
    pointsMultiplier: input.pointsMultiplier,
  })
  const normalizedOptions = normalizeElementOptions(input)
  if (!normalizedOptions) return null

  const mediaNormalizedElement = normalizeElementMedia(
    {
      type: shared.type,
      content: shared.content,
      explanation: shared.explanation,
      options: normalizedOptions,
    },
    input.media
  )
  if (!mediaNormalizedElement) return null

  const answerPoolValues =
    typeof input.preparedAnswerPoolValues === 'undefined'
      ? normalizePlainTextValues(input.answerPoolValues ?? [])
      : (input.preparedAnswerPoolValues?.values ?? null)
  const selectedAnswerValues = normalizePlainTextValues(
    input.selectedAnswerValues ?? []
  )
  if (!answerPoolValues || !selectedAnswerValues) return null

  return createVersionedFingerprint('element', {
    type: shared.type,
    content: mediaNormalizedElement.content,
    explanation: mediaNormalizedElement.explanation ?? null,
    options: mediaNormalizedElement.options,
    pointsMultiplier: shared.pointsMultiplier,
    basePoints: shared.basePoints,
    answerPoolValues,
    selectedAnswerValues,
  })
}

const PERSISTED_LEGACY_FALLBACK_DOMAIN =
  'klicker-import-export:persisted-legacy-fallback:v1'

function normalizePersistedPlainTextValues(values: readonly string[]) {
  return [...values].sort(compareStrings)
}

/**
 * Computes the current fingerprint for a persisted answer collection.
 *
 * Strict portable resources retain exactly the package-domain identity. The
 * fallback is reserved for historical persisted values that cannot satisfy
 * that domain (for example, a legacy package transport href in a plain-text
 * entry), and is explicitly domain-separated from canonical package hashes.
 */
export function computePersistedAnswerCollectionDidacticFingerprint(
  input: AnswerCollectionDidacticFingerprintInput
): VersionedDidacticFingerprint {
  const strict = computeAnswerCollectionDidacticFingerprint(input)
  if (strict) return strict

  return createVersionedFingerprint('answer-collection', {
    domain: PERSISTED_LEGACY_FALLBACK_DOMAIN,
    values: normalizePersistedPlainTextValues(
      input.preparedValues?.values ?? input.entries.map((entry) => entry.value)
    ),
  })
}

/**
 * Computes the current fingerprint for a persisted element without producing
 * a nullable state. Malformed historical didactic structures are hashed as a
 * stable, domain-separated legacy payload. Media is first transformed with
 * the exact package-export image rules, so unavailable auto-loading images are
 * deterministic and ordinary links sharing their href remain authored data.
 */
export function computePersistedElementDidacticFingerprint(
  input: ElementDidacticFingerprintInput
): VersionedDidacticFingerprint {
  const strict = computeElementDidacticFingerprint(input)
  if (strict) return strict

  const mediaNormalizedElement = normalizePersistedElementMedia(
    {
      type: input.type,
      content: input.content,
      explanation: input.explanation,
      options: input.options,
    },
    input.media
  )

  return createVersionedFingerprint('element', {
    domain: PERSISTED_LEGACY_FALLBACK_DOMAIN,
    type: input.type,
    content: mediaNormalizedElement.content,
    explanation: mediaNormalizedElement.explanation ?? null,
    options: mediaNormalizedElement.options,
    pointsMultiplier: input.pointsMultiplier,
    basePoints: input.basePoints,
    answerPoolValues: normalizePersistedPlainTextValues(
      input.preparedAnswerPoolValues?.values ?? input.answerPoolValues ?? []
    ),
    selectedAnswerValues: normalizePersistedPlainTextValues(
      input.selectedAnswerValues ?? []
    ),
  })
}
