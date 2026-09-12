import { ElementType } from '@klicker-uzh/prisma/client'
import {
  collectMarkdownMediaReferences,
  collectPlainTextMediaReferences,
  omitExternalAutoLoadingMarkdownImages,
  rewriteExportMarkdownImages,
  rewriteMarkdownMediaReferences,
  rewritePlainTextMediaReferences,
} from './importExportMarkdownMediaReferences.js'
import {
  type AnswerCollectionMediaReferenceSource,
  type ElementMediaReference,
  type ElementMediaReferenceSource,
  MediaReferenceKind,
  type MediaReferenceKind as MediaReferenceKindType,
} from './importExportMediaReferenceTypes.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function getElementOptionMarkdownValues(
  element: ElementMediaReferenceSource
) {
  const options = isRecord(element.options) ? element.options : null
  if (!options) return []

  if (
    element.type === ElementType.SC ||
    element.type === ElementType.MC ||
    element.type === ElementType.KPRIM
  ) {
    return Array.isArray(options.choices)
      ? options.choices.flatMap((choice) => {
          if (!isRecord(choice)) return []
          return [choice.value, choice.feedback].filter(
            (value): value is string => typeof value === 'string'
          )
        })
      : []
  }

  if (element.type === ElementType.CASE_STUDY) {
    return Array.isArray(options.cases)
      ? options.cases.flatMap((caseItem) =>
          isRecord(caseItem) && typeof caseItem.description === 'string'
            ? [caseItem.description]
            : []
        )
      : []
  }

  return []
}

function transformElementMarkdownOptions(
  element: ElementMediaReferenceSource,
  transform: (source: string) => string
) {
  const options = isRecord(element.options) ? element.options : null
  if (!options) return element.options

  if (
    element.type === ElementType.SC ||
    element.type === ElementType.MC ||
    element.type === ElementType.KPRIM
  ) {
    if (!Array.isArray(options.choices)) return element.options
    return {
      ...options,
      choices: options.choices.map((choice) => {
        if (!isRecord(choice)) return choice
        return {
          ...choice,
          value:
            typeof choice.value === 'string'
              ? transform(choice.value)
              : choice.value,
          feedback:
            typeof choice.feedback === 'string'
              ? transform(choice.feedback)
              : choice.feedback,
        }
      }),
    }
  }

  if (element.type === ElementType.CASE_STUDY) {
    if (!Array.isArray(options.cases)) return element.options
    return {
      ...options,
      cases: options.cases.map((caseItem) => {
        if (!isRecord(caseItem)) return caseItem
        return {
          ...caseItem,
          description:
            typeof caseItem.description === 'string'
              ? transform(caseItem.description)
              : caseItem.description,
        }
      }),
    }
  }

  return element.options
}

function mergeMediaReferences(
  referenceGroups: readonly ElementMediaReference[][]
) {
  const references = new Map<string, MediaReferenceKindType>()

  for (const group of referenceGroups) {
    for (const reference of group) {
      const previousKind = references.get(reference.href)
      if (!previousKind || reference.kind === MediaReferenceKind.AUTO_LOAD) {
        references.set(reference.href, reference.kind)
      }
    }
  }

  return Array.from(references, ([href, kind]) => ({ href, kind }))
}

export function collectElementMediaReferences(
  element: ElementMediaReferenceSource
): ElementMediaReference[] {
  return mergeMediaReferences(
    [
      element.content,
      element.explanation ?? '',
      ...getElementOptionMarkdownValues(element),
    ].map(collectMarkdownMediaReferences)
  )
}

export function collectAnswerCollectionMediaReferences(
  collection: AnswerCollectionMediaReferenceSource
) {
  return mergeMediaReferences([
    collectMarkdownMediaReferences(collection.description),
    ...collection.entries.map((entry) =>
      collectPlainTextMediaReferences(entry.value)
    ),
  ])
}

export function rewriteAnswerCollectionMediaReferences<
  Collection extends AnswerCollectionMediaReferenceSource,
>(
  collection: Collection,
  replacements: ReadonlyMap<string, string>
): Collection {
  if (replacements.size === 0) return collection

  return {
    ...collection,
    description: rewriteMarkdownMediaReferences(
      collection.description,
      replacements
    ),
    entries: collection.entries.map((entry) => ({
      ...entry,
      value: rewritePlainTextMediaReferences(entry.value, replacements),
    })),
  }
}

export function rewriteElementMediaReferences<
  Element extends ElementMediaReferenceSource,
>(element: Element, replacements: ReadonlyMap<string, string>): Element {
  if (replacements.size === 0) return element

  return {
    ...element,
    content: rewriteMarkdownMediaReferences(element.content, replacements),
    explanation:
      typeof element.explanation === 'string'
        ? rewriteMarkdownMediaReferences(element.explanation, replacements)
        : element.explanation,
    options: transformElementMarkdownOptions(element, (source) =>
      rewriteMarkdownMediaReferences(source, replacements)
    ),
  }
}

export function rewriteExportAnswerCollectionMediaReferences<
  Collection extends AnswerCollectionMediaReferenceSource,
>(
  collection: Collection,
  replacements: ReadonlyMap<string, string>
): Collection {
  return {
    ...collection,
    description: rewriteExportMarkdownImages(
      collection.description,
      replacements
    ),
  }
}

export function rewriteExportElementMediaReferences<
  Element extends ElementMediaReferenceSource,
>(element: Element, replacements: ReadonlyMap<string, string>): Element {
  return {
    ...element,
    content: rewriteExportMarkdownImages(element.content, replacements),
    explanation:
      typeof element.explanation === 'string'
        ? rewriteExportMarkdownImages(element.explanation, replacements)
        : element.explanation,
    options: transformElementMarkdownOptions(element, (source) =>
      rewriteExportMarkdownImages(source, replacements)
    ),
  }
}

export function omitExternalAutoLoadingAnswerCollectionMediaReferences<
  Collection extends AnswerCollectionMediaReferenceSource,
>(collection: Collection): Collection {
  return {
    ...collection,
    description: omitExternalAutoLoadingMarkdownImages(collection.description),
  }
}

export function omitExternalAutoLoadingElementMediaReferences<
  Element extends ElementMediaReferenceSource,
>(element: Element): Element {
  return {
    ...element,
    content: omitExternalAutoLoadingMarkdownImages(element.content),
    explanation:
      typeof element.explanation === 'string'
        ? omitExternalAutoLoadingMarkdownImages(element.explanation)
        : element.explanation,
    options: transformElementMarkdownOptions(
      element,
      omitExternalAutoLoadingMarkdownImages
    ),
  }
}

export function collectElementMediaHrefs(
  element: ElementMediaReferenceSource,
  kind?: MediaReferenceKindType
) {
  return collectElementMediaReferences(element)
    .filter((reference) => !kind || reference.kind === kind)
    .map((reference) => reference.href)
}
