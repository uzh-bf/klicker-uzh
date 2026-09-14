import * as DB from '@klicker-uzh/prisma/client'
import { ElementOptionsInput } from '@klicker-uzh/types'
import { z } from 'zod'
import {
  type CanonicalCaseStudyOptions,
  canonicalizeCaseStudyRelations,
  normalizeCaseStudyOptions,
  parseCaseStudyAuthoringOptions,
} from './elementDomain/caseStudy.js'
import { normalizeChoicesOptions } from './elementDomain/choice.js'
import { normalizeContentOptions } from './elementDomain/content.js'
import {
  ELEMENT_DOMAIN_LIMITS,
  ElementDomainIssueCode,
  ElementDomainValidationError,
  type ElementReference,
  type ElementRelationContext,
  isMeaningfulText,
  issue,
  normalizeAuthoredText,
} from './elementDomain/core.js'
import { normalizeFreeTextOptions } from './elementDomain/freeText.js'
import { normalizeNumericalOptions } from './elementDomain/numerical.js'
import {
  canonicalizeSelectionRelations,
  normalizeSelectionOptions,
  parseSelectionAuthoringOptions,
} from './elementDomain/selection.js'

export {
  ELEMENT_DOMAIN_LIMITS,
  ElementDomainIssueCode,
  ElementDomainValidationError,
} from './elementDomain/core.js'
export type {
  ElementDomainIssue,
  ElementRelationContext,
} from './elementDomain/core.js'

export const MAX_ELEMENT_POINTS_MULTIPLIER =
  ELEMENT_DOMAIN_LIMITS.pointsMultiplierMax

export type CanonicalOptionsByElementType = {
  [DB.ElementType.SC]: ReturnType<typeof normalizeChoicesOptions>
  [DB.ElementType.MC]: ReturnType<typeof normalizeChoicesOptions>
  [DB.ElementType.KPRIM]: ReturnType<typeof normalizeChoicesOptions>
  [DB.ElementType.NUMERICAL]: ReturnType<typeof normalizeNumericalOptions>
  [DB.ElementType.FREE_TEXT]: ReturnType<typeof normalizeFreeTextOptions>
  [DB.ElementType.SELECTION]: ReturnType<typeof normalizeSelectionOptions>
  [DB.ElementType.CASE_STUDY]: CanonicalCaseStudyOptions
  [DB.ElementType.CONTENT]: ReturnType<typeof normalizeContentOptions>
  [DB.ElementType.FLASHCARD]: ReturnType<typeof normalizeContentOptions>
}

export type CanonicalElementDomain<
  Type extends DB.ElementType = DB.ElementType,
  Id extends ElementReference = ElementReference,
> = Type extends DB.ElementType
  ? {
      type: Type
      content: string
      explanation: string | null
      basePoints: boolean
      pointsMultiplier: number
      options: CanonicalOptionsByElementType[Type]
      relations: {
        answerCollectionId?: Id
        selectedIds: Id[]
      }
    }
  : never

type CanonicalElementOptionsResult<
  Type extends DB.ElementType,
  Id extends ElementReference,
> = {
  options: CanonicalOptionsByElementType[Type]
  relations: {
    answerCollectionId?: Id
    selectedIds: Id[]
  }
}

type PreviousElementDomainFields = {
  content: string
  explanation: string | null
  basePoints: boolean
  pointsMultiplier: number
}

function canonicalizeRelations<Id extends ElementReference>(
  type: DB.ElementType,
  options: Record<string, unknown>,
  relations?: ElementRelationContext<Id>
) {
  if (type === DB.ElementType.SELECTION) {
    return canonicalizeSelectionRelations(options, relations)
  }
  if (type === DB.ElementType.CASE_STUDY) {
    return canonicalizeCaseStudyRelations(options, relations)
  }

  if (
    typeof relations?.answerCollectionId !== 'undefined' ||
    (relations?.selectedIds?.length ?? 0) > 0
  ) {
    issue(ElementDomainIssueCode.INVALID_RELATION)
  }
  return { selectedIds: [] as Id[] }
}

export function canonicalizeElementOptions<
  Type extends DB.ElementType,
  Id extends ElementReference,
>({
  type,
  options: rawOptions,
  relations,
}: {
  type: Type
  options: unknown
  relations?: ElementRelationContext<Id>
}): CanonicalElementOptionsResult<Type, Id> {
  const referenceKey = relations?.caseSolutionReferenceKey ?? 'itemId'
  const options = (() => {
    switch (type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return normalizeChoicesOptions(type, rawOptions)
      case DB.ElementType.NUMERICAL:
        return normalizeNumericalOptions(rawOptions)
      case DB.ElementType.FREE_TEXT:
        return normalizeFreeTextOptions(rawOptions)
      case DB.ElementType.SELECTION:
        return normalizeSelectionOptions(rawOptions)
      case DB.ElementType.CASE_STUDY:
        return normalizeCaseStudyOptions(rawOptions, referenceKey)
      case DB.ElementType.CONTENT:
      case DB.ElementType.FLASHCARD:
        return normalizeContentOptions(rawOptions)
    }
  })() as CanonicalOptionsByElementType[Type]

  return {
    options,
    relations: canonicalizeRelations(
      type,
      options as Record<string, unknown>,
      relations
    ),
  }
}

export function canonicalizeElementAuthoringOptions<
  Type extends DB.ElementType,
>(
  type: Type,
  rawOptions?: ElementOptionsInput | null,
  { poolIds }: { poolIds?: readonly number[] } = {}
): CanonicalElementOptionsResult<Type, number> {
  if (type === DB.ElementType.SELECTION) {
    const parsed = parseSelectionAuthoringOptions(rawOptions)
    return canonicalizeElementOptions({
      type,
      options: {
        hasSampleSolution: parsed.hasSampleSolution,
        numberOfInputs: parsed.numberOfInputs,
      },
      relations: {
        answerCollectionId: parsed.answerCollection,
        poolIds,
        selectedIds: parsed.correctAnswers ?? [],
      },
    })
  }

  if (type === DB.ElementType.CASE_STUDY) {
    const parsed = parseCaseStudyAuthoringOptions(rawOptions)
    const { answerCollection, collectionItemIds, ...options } = parsed
    return canonicalizeElementOptions({
      type,
      options,
      relations: {
        answerCollectionId: answerCollection,
        poolIds,
        selectedIds: collectionItemIds,
        caseSolutionReferenceKey: 'itemId',
      },
    })
  }

  return canonicalizeElementOptions({ type, options: rawOptions ?? {} })
}

export function canonicalizeElementDomain<
  Type extends DB.ElementType,
  Id extends ElementReference,
>({
  type,
  content,
  explanation,
  basePoints,
  pointsMultiplier,
  options,
  relations,
}: {
  type: Type
  content: unknown
  explanation?: unknown
  basePoints: unknown
  pointsMultiplier: unknown
  options: unknown
  relations?: ElementRelationContext<Id>
}): CanonicalElementDomain<Type, Id> {
  const shared = canonicalizeElementSharedFields({
    type,
    content,
    explanation,
    basePoints,
    pointsMultiplier,
  })
  const canonical = canonicalizeElementOptions({ type, options, relations })
  return {
    ...shared,
    options: canonical.options,
    relations: canonical.relations,
  } as CanonicalElementDomain<Type, Id>
}

export function canonicalizeElementSharedFields<Type extends DB.ElementType>({
  type,
  content,
  explanation,
  basePoints,
  pointsMultiplier,
}: {
  type: Type
  content: unknown
  explanation?: unknown
  basePoints: unknown
  pointsMultiplier: unknown
}) {
  return {
    type,
    content: canonicalizeElementContent(content),
    explanation: canonicalizeElementExplanation(type, explanation),
    basePoints: canonicalizeElementBasePoints(type, basePoints),
    pointsMultiplier: canonicalizeElementPointsMultiplier(pointsMultiplier),
  }
}

function canonicalizeElementContent(content: unknown) {
  if (typeof content !== 'string' || !isMeaningfulText(content)) {
    issue(ElementDomainIssueCode.INVALID_TEXT, ['content'])
  }

  return normalizeAuthoredText(content)
}

function canonicalizeElementExplanation(
  type: DB.ElementType,
  explanation: unknown
) {
  if (
    explanation !== null &&
    typeof explanation !== 'undefined' &&
    typeof explanation !== 'string'
  ) {
    issue(ElementDomainIssueCode.INVALID_TEXT, ['explanation'])
  }
  if (
    type === DB.ElementType.FLASHCARD &&
    (typeof explanation !== 'string' || !isMeaningfulText(explanation))
  ) {
    issue(ElementDomainIssueCode.INVALID_TEXT, ['explanation'])
  }

  return typeof explanation === 'string'
    ? normalizeAuthoredText(explanation)
    : null
}

function canonicalizeElementBasePoints(
  type: DB.ElementType,
  basePoints: unknown
) {
  if (typeof basePoints !== 'boolean') {
    issue(ElementDomainIssueCode.INVALID_SHAPE, ['basePoints'])
  }

  return type === DB.ElementType.CONTENT || type === DB.ElementType.FLASHCARD
    ? false
    : basePoints
}

function canonicalizeElementPointsMultiplier(pointsMultiplier: unknown) {
  if (
    typeof pointsMultiplier !== 'number' ||
    !Number.isInteger(pointsMultiplier) ||
    pointsMultiplier < ELEMENT_DOMAIN_LIMITS.pointsMultiplierMin ||
    pointsMultiplier > ELEMENT_DOMAIN_LIMITS.pointsMultiplierMax
  ) {
    issue(ElementDomainIssueCode.INVALID_SHAPE, ['pointsMultiplier'])
  }

  return pointsMultiplier
}

export function canonicalizeElementSharedFieldsPatch<
  Type extends DB.ElementType,
>({
  type,
  content,
  explanation,
  basePoints,
  pointsMultiplier,
  previous,
}: {
  type: Type
  content?: unknown
  explanation?: unknown
  basePoints?: unknown
  pointsMultiplier?: unknown
  previous: PreviousElementDomainFields
}) {
  return {
    type,
    content:
      typeof content === 'undefined'
        ? previous.content
        : canonicalizeElementContent(content),
    explanation:
      typeof explanation === 'undefined'
        ? previous.explanation
        : canonicalizeElementExplanation(type, explanation),
    basePoints:
      typeof basePoints === 'undefined'
        ? previous.basePoints
        : canonicalizeElementBasePoints(type, basePoints),
    pointsMultiplier:
      typeof pointsMultiplier === 'undefined'
        ? previous.pointsMultiplier
        : canonicalizeElementPointsMultiplier(pointsMultiplier),
  }
}

export function canonicalizeElementSharedFieldsUpdate<
  Type extends DB.ElementType,
>({
  type,
  content,
  explanation,
  basePoints,
  pointsMultiplier,
  previous,
}: {
  type: Type
  content?: unknown
  explanation?: unknown
  basePoints?: unknown
  pointsMultiplier?: unknown
  previous?: PreviousElementDomainFields
}) {
  const isNonQuestion =
    type === DB.ElementType.CONTENT || type === DB.ElementType.FLASHCARD

  return canonicalizeElementSharedFields({
    type,
    content: typeof content === 'undefined' ? previous?.content : content,
    explanation:
      typeof explanation === 'undefined' ? previous?.explanation : explanation,
    basePoints:
      typeof basePoints === 'undefined'
        ? (previous?.basePoints ?? (isNonQuestion ? false : undefined))
        : basePoints,
    pointsMultiplier:
      typeof pointsMultiplier === 'undefined'
        ? (previous?.pointsMultiplier ?? (isNonQuestion ? 1 : undefined))
        : pointsMultiplier,
  })
}

export function canonicalizeElementDomainUpdate<
  Type extends DB.ElementType,
  Id extends ElementReference,
>({
  type,
  content,
  explanation,
  basePoints,
  pointsMultiplier,
  options,
  relations,
  previous,
}: {
  type: Type
  content?: unknown
  explanation?: unknown
  basePoints?: unknown
  pointsMultiplier?: unknown
  options: unknown
  relations?: ElementRelationContext<Id>
  previous?: PreviousElementDomainFields
}): CanonicalElementDomain<Type, Id> {
  const shared = canonicalizeElementSharedFieldsUpdate({
    type,
    content,
    explanation,
    basePoints,
    pointsMultiplier,
    previous,
  })
  const canonical = canonicalizeElementOptions({ type, options, relations })
  return {
    ...shared,
    options: canonical.options,
    relations: canonical.relations,
  } as CanonicalElementDomain<Type, Id>
}

export function createCanonicalElementOptionsSchema<
  Type extends DB.ElementType,
>(type: Type, caseSolutionReferenceKey: 'itemId' | 'itemRef' = 'itemId') {
  return z
    .unknown()
    .transform((value, ctx): CanonicalOptionsByElementType[Type] => {
      try {
        return canonicalizeElementOptions({
          type,
          options: value,
          relations:
            type === DB.ElementType.CASE_STUDY
              ? {
                  caseSolutionReferenceKey,
                }
              : undefined,
        }).options
      } catch (error) {
        if (!(error instanceof ElementDomainValidationError)) throw error

        for (const entry of error.issues) {
          const relativePath =
            entry.path[0] === 'options' ? entry.path.slice(1) : entry.path
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...relativePath],
            message: entry.code,
          })
        }
        return z.NEVER
      }
    })
}
