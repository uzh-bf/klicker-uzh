import { getElementOptionMarkdownValues } from './importExportElementMediaReferences.js'
import {
  canContainMarkdownImage,
  canContainSupportedHref,
} from './importExportMarkdownMediaReferences.js'
import type {
  AnswerCollectionMediaReferenceSource,
  ElementMediaReferenceSource,
  MediaReferenceWork,
} from './importExportMediaReferenceTypes.js'
import {
  MAX_IMPORT_EXPORT_MEDIA_MARKDOWN_WORK_UNITS,
  MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES,
} from './importExportPackageConfig.js'

const MEDIA_REFERENCE_CANDIDATE_PATTERN =
  /!\[|https?:\/\/|klicker-package-media:\/\/|\/\//gi
const PLAIN_TEXT_MEDIA_REFERENCE_CANDIDATE_PATTERN =
  /https?:\/\/|klicker-package-media:\/\//gi
const MARKDOWN_WORK_CHARACTERS = '!*_()[]`'

function countPatternMatches(source: string, pattern: RegExp) {
  let candidateOccurrences = 0
  pattern.lastIndex = 0
  while (pattern.exec(source)) {
    candidateOccurrences += 1
  }
  return candidateOccurrences
}

function measureMediaReferenceSourceWork(source: string): MediaReferenceWork {
  if (!canContainSupportedHref(source) && !canContainMarkdownImage(source)) {
    return { candidateOccurrences: 0, markdownWorkUnits: 0 }
  }

  const candidateOccurrences = countPatternMatches(
    source,
    MEDIA_REFERENCE_CANDIDATE_PATTERN
  )

  let markdownWorkUnits = 0
  for (let index = 0; index < source.length; index += 1) {
    if (MARKDOWN_WORK_CHARACTERS.includes(source[index]!)) {
      markdownWorkUnits += 1
    }
  }

  return { candidateOccurrences, markdownWorkUnits }
}

function measurePlainTextMediaReferenceSourceWork(
  source: string
): MediaReferenceWork {
  if (!canContainSupportedHref(source)) {
    return { candidateOccurrences: 0, markdownWorkUnits: 0 }
  }

  return {
    candidateOccurrences: countPatternMatches(
      source,
      PLAIN_TEXT_MEDIA_REFERENCE_CANDIDATE_PATTERN
    ),
    markdownWorkUnits: 0,
  }
}

function mergeMediaReferenceWork(
  values: readonly MediaReferenceWork[]
): MediaReferenceWork {
  return values.reduce<MediaReferenceWork>(
    (total, value) => ({
      candidateOccurrences:
        total.candidateOccurrences + value.candidateOccurrences,
      markdownWorkUnits: total.markdownWorkUnits + value.markdownWorkUnits,
    }),
    { candidateOccurrences: 0, markdownWorkUnits: 0 }
  )
}

export function measureElementMediaReferenceWork(
  element: ElementMediaReferenceSource
): MediaReferenceWork {
  return mergeMediaReferenceWork(
    [
      element.content,
      element.explanation ?? '',
      ...getElementOptionMarkdownValues(element),
    ].map(measureMediaReferenceSourceWork)
  )
}

export function measureAnswerCollectionMediaReferenceWork(
  collection: AnswerCollectionMediaReferenceSource
): MediaReferenceWork {
  return mergeMediaReferenceWork([
    measureMediaReferenceSourceWork(collection.description),
    ...collection.entries.map((entry) =>
      measurePlainTextMediaReferenceSourceWork(entry.value)
    ),
  ])
}

export function isImportExportMediaReferenceWorkBounded(
  elements: readonly ElementMediaReferenceSource[],
  answerCollections: readonly AnswerCollectionMediaReferenceSource[]
) {
  let candidateOccurrences = 0
  let markdownWorkUnits = 0

  const addWork = (work: MediaReferenceWork) => {
    candidateOccurrences += work.candidateOccurrences
    markdownWorkUnits += work.markdownWorkUnits
    return (
      candidateOccurrences <= MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES &&
      markdownWorkUnits <= MAX_IMPORT_EXPORT_MEDIA_MARKDOWN_WORK_UNITS
    )
  }

  for (const element of elements) {
    if (!addWork(measureElementMediaReferenceWork(element))) return false
  }
  for (const collection of answerCollections) {
    if (!addWork(measureAnswerCollectionMediaReferenceWork(collection))) {
      return false
    }
  }

  return true
}
