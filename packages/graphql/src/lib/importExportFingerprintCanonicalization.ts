import { ElementType } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import {
  collectElementMediaReferences,
  collectPlainTextMediaReferences,
  isPackageMediaHref,
  MediaReferenceKind,
  rewriteElementMediaReferences,
} from './importExportMediaReferences.js'

export const IMPORT_EXPORT_FINGERPRINT_VERSION = 1 as const

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
  unresolvedHrefs?: ReadonlySet<string>
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
  version: typeof IMPORT_EXPORT_FINGERPRINT_VERSION
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
        version: IMPORT_EXPORT_FINGERPRINT_VERSION,
        payload,
      })
    )
    .digest('hex')

  return {
    version: IMPORT_EXPORT_FINGERPRINT_VERSION,
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
 * Prepares the exact canonical value array used by fingerprint version 1.
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
    if (verifiedIdentity === null) return null

    if (verifiedIdentity) {
      replacements.set(reference.href, verifiedIdentity)
      continue
    }

    if (isPackageMediaHref(reference.href)) {
      return null
    }

    if (media?.unresolvedHrefs?.has(reference.href)) {
      return null
    }

    replacements.set(reference.href, OMITTED_AUTO_LOAD_MEDIA_IDENTITY)
  }

  return rewriteElementMediaReferences(element, replacements)
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
  const normalizedOptions = normalizeElementOptions(input)
  if (!normalizedOptions) return null

  const mediaNormalizedElement = normalizeElementMedia(
    {
      type: input.type,
      content: input.content,
      explanation: input.explanation,
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
    type: input.type,
    content: mediaNormalizedElement.content,
    explanation: mediaNormalizedElement.explanation ?? null,
    options: mediaNormalizedElement.options,
    pointsMultiplier: input.pointsMultiplier,
    basePoints: input.basePoints,
    answerPoolValues,
    selectedAnswerValues,
  })
}
