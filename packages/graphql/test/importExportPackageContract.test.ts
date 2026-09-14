import { ElementType } from '@klicker-uzh/prisma/client'
import { ImportExportWarningCode } from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../src/lib/importExportPackageConfig.js'
import {
  answerCollectionSchema,
  elementSchema,
  isSupportedPackageMediaContentType,
  manifestSchema,
  mediaManifestEntrySchema,
  packageRefSchema,
} from '../src/lib/importExportPackageContract.js'

const SHA_256 = 'a'.repeat(64)

function createElementManifestEntry(index: number) {
  const ref = `element-${index}`
  return { ref, file: `elements/${ref}.json` }
}

function createAnswerCollectionManifestEntry(index: number) {
  const ref = `collection-${index}`
  return { ref, file: `answer-collections/${ref}.json` }
}

function createMediaManifestEntry(index: number) {
  const ref = `media-${index}`
  const filename = `asset-${index}.png`
  return {
    ref,
    file: `media/${filename}`,
    filename,
    contentType: 'image/png',
    bytes: 1,
    sha256: SHA_256,
    sourceHref: `klicker-package-media://${ref}`,
  }
}

function createManifest(overrides: Record<string, unknown> = {}) {
  return {
    type: 'klicker-element-package',
    version: 3,
    createdAt: '2026-07-12T10:00:00.000Z',
    elements: [createElementManifestEntry(0)],
    answerCollections: [],
    media: [],
    ...overrides,
  }
}

function createAnswerCollection(entryCount = 1) {
  return {
    ref: 'collection-0',
    name: 'Collection',
    description: '',
    entries: Array.from({ length: entryCount }, (_, index) => ({
      ref: `item-${index}`,
      value: `Item ${index}`,
    })),
  }
}

function createChoiceOptions(choiceCount = 2) {
  return {
    displayMode: 'LIST',
    hasSampleSolution: false,
    hasAnswerFeedbacks: false,
    choices: Array.from({ length: choiceCount }, (_, index) => ({
      ix: index,
      value: `Choice ${index}`,
    })),
  }
}

function createElement(type: ElementType): Record<string, unknown> {
  const common = {
    ref: 'element-0',
    name: 'Element',
    content: 'Question content',
    type,
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
  }

  switch (type) {
    case ElementType.SC:
    case ElementType.MC:
      return { ...common, options: createChoiceOptions() }
    case ElementType.KPRIM:
      return { ...common, options: createChoiceOptions(4) }
    case ElementType.NUMERICAL:
    case ElementType.FREE_TEXT:
      return { ...common, options: { hasSampleSolution: false } }
    case ElementType.SELECTION:
      return {
        ...common,
        options: { hasSampleSolution: false, numberOfInputs: 1 },
        answerCollectionRef: 'collection-0',
      }
    case ElementType.CASE_STUDY:
      return {
        ...common,
        options: {
          hasSampleSolution: false,
          criteria: [
            {
              id: 'criterion-0',
              name: 'Quality',
              order: 0,
              min: 0,
              max: 5,
              step: 1,
            },
          ],
          cases: [
            {
              id: 'case-0',
              title: 'Case',
              description: 'Case description',
              order: 0,
            },
          ],
        },
        answerCollectionRef: 'collection-0',
        answerCollectionItemRefs: ['item-0'],
      }
    case ElementType.CONTENT:
    case ElementType.FLASHCARD:
      return { ...common, options: {} }
  }
}

describe('import/export package manifest contract', () => {
  it.each([
    { count: 1, valid: true },
    { count: 100, valid: true },
    { count: 101, valid: false },
  ])('enforces the element count boundary at $count', ({ count, valid }) => {
    const result = manifestSchema.safeParse(
      createManifest({
        elements: Array.from({ length: count }, (_, index) =>
          createElementManifestEntry(index)
        ),
      })
    )

    expect(result.success).toBe(valid)
  })

  it('requires at least one element', () => {
    expect(
      manifestSchema.safeParse(createManifest({ elements: [] })).success
    ).toBe(false)
  })

  it.each([
    { count: 50, valid: true },
    { count: 51, valid: false },
  ])('enforces the answer-collection count boundary at $count', ({
    count,
    valid,
  }) => {
    const result = manifestSchema.safeParse(
      createManifest({
        answerCollections: Array.from({ length: count }, (_, index) =>
          createAnswerCollectionManifestEntry(index)
        ),
      })
    )

    expect(result.success).toBe(valid)
  })

  it.each([
    { count: 100, valid: true },
    { count: 101, valid: false },
  ])('enforces the media count boundary at $count', ({ count, valid }) => {
    const result = manifestSchema.safeParse(
      createManifest({
        media: Array.from({ length: count }, (_, index) =>
          createMediaManifestEntry(index)
        ),
      })
    )

    expect(result.success).toBe(valid)
  })

  it('accepts 200 warning entries, deduplicates them, and rejects 201', () => {
    const warning = ImportExportWarningCode.STATUS_NORMALIZED
    const accepted = manifestSchema.safeParse(
      createManifest({ warnings: Array.from({ length: 200 }, () => warning) })
    )

    expect(accepted.success).toBe(true)
    if (accepted.success) expect(accepted.data.warnings).toEqual([warning])
    expect(
      manifestSchema.safeParse(
        createManifest({ warnings: Array.from({ length: 201 }, () => warning) })
      ).success
    ).toBe(false)
  })

  it.each([
    'elements/other.json',
    'elements//element-0.json',
    'elements/./element-0.json',
    'elements/../element-0.json',
    '/elements/element-0.json',
    'elements\\element-0.json',
  ])('rejects a non-canonical element file path: %s', (file) => {
    expect(
      manifestSchema.safeParse(
        createManifest({ elements: [{ ref: 'element-0', file }] })
      ).success
    ).toBe(false)
  })

  it('requires exact canonical answer-collection paths', () => {
    expect(
      manifestSchema.safeParse(
        createManifest({
          answerCollections: [
            { ref: 'collection-0', file: 'collections/collection-0.json' },
          ],
        })
      ).success
    ).toBe(false)
  })

  it('requires media file/filename and ref/sourceHref agreement', () => {
    const valid = createMediaManifestEntry(0)
    expect(mediaManifestEntrySchema.safeParse(valid).success).toBe(true)
    expect(
      mediaManifestEntrySchema.safeParse({
        ...valid,
        file: 'media/different.png',
      }).success
    ).toBe(false)
    expect(
      mediaManifestEntrySchema.safeParse({
        ...valid,
        sourceHref: 'klicker-package-media://different',
      }).success
    ).toBe(false)
    expect(
      mediaManifestEntrySchema.safeParse({
        ...valid,
        filename: '../asset.png',
      }).success
    ).toBe(false)
  })

  it('accepts positive media through the byte cap and rejects empty media or one byte more', () => {
    const entry = createMediaManifestEntry(0)
    expect(
      mediaManifestEntrySchema.safeParse({
        ...entry,
        bytes: 0,
      }).success
    ).toBe(false)
    expect(
      mediaManifestEntrySchema.safeParse({
        ...entry,
        bytes: MAX_IMPORT_EXPORT_MEDIA_BYTES,
      }).success
    ).toBe(true)
    expect(
      mediaManifestEntrySchema.safeParse({
        ...entry,
        bytes: MAX_IMPORT_EXPORT_MEDIA_BYTES + 1,
      }).success
    ).toBe(false)
  })

  it('excludes SVG from the package media contract', () => {
    expect(isSupportedPackageMediaContentType('image/png')).toBe(true)
    expect(isSupportedPackageMediaContentType('image/svg+xml')).toBe(false)
  })

  it('rejects duplicate refs globally across manifest entry kinds', () => {
    expect(
      manifestSchema.safeParse(
        createManifest({
          answerCollections: [
            {
              ref: 'element-0',
              file: 'answer-collections/element-0.json',
            },
          ],
        })
      ).success
    ).toBe(false)
    expect(
      manifestSchema.safeParse(
        createManifest({
          media: [
            {
              ...createMediaManifestEntry(0),
              ref: 'element-0',
              sourceHref: 'klicker-package-media://element-0',
            },
          ],
        })
      ).success
    ).toBe(false)
  })

  it('rejects duplicate manifest file paths', () => {
    const entry = createElementManifestEntry(0)
    expect(
      manifestSchema.safeParse(
        createManifest({ elements: [entry, { ...entry }] })
      ).success
    ).toBe(false)
  })
})

describe('import/export package reference contract', () => {
  it.each([
    '__proto__',
    '__PROTO__',
    'prototype',
    'Prototype',
    'constructor',
  ])('rejects reserved ref %s throughout package schemas', (ref) => {
    expect(packageRefSchema.safeParse(ref).success).toBe(false)
    expect(
      manifestSchema.safeParse(
        createManifest({ elements: [{ ref, file: `elements/${ref}.json` }] })
      ).success
    ).toBe(false)
    expect(
      answerCollectionSchema.safeParse({
        ...createAnswerCollection(),
        ref,
      }).success
    ).toBe(false)
    expect(
      answerCollectionSchema.safeParse({
        ...createAnswerCollection(),
        entries: [{ ref, value: 'Item' }],
      }).success
    ).toBe(false)
    expect(
      mediaManifestEntrySchema.safeParse({
        ...createMediaManifestEntry(0),
        ref,
        sourceHref: `klicker-package-media://${ref}`,
      }).success
    ).toBe(false)
    expect(
      elementSchema.safeParse({ ...createElement(ElementType.SC), ref }).success
    ).toBe(false)
  })
})

describe('import/export answer-collection contract', () => {
  it.each([
    { count: 1, valid: true },
    { count: 2000, valid: true },
    { count: 2001, valid: false },
  ])('enforces the entry count boundary at $count', ({ count, valid }) => {
    expect(
      answerCollectionSchema.safeParse(createAnswerCollection(count)).success
    ).toBe(valid)
  })

  it('rejects source answer-collection versions', () => {
    expect(
      answerCollectionSchema.safeParse({
        ...createAnswerCollection(),
        version: 42,
      }).success
    ).toBe(false)
  })
})

describe('import/export element relation contract', () => {
  it('rejects source element status', () => {
    expect(
      elementSchema.safeParse({
        ...createElement(ElementType.SC),
        status: 'READY',
      }).success
    ).toBe(false)
  })

  it.each([
    ElementType.SC,
    ElementType.MC,
    ElementType.KPRIM,
    ElementType.NUMERICAL,
    ElementType.FREE_TEXT,
    ElementType.CONTENT,
    ElementType.FLASHCARD,
  ])('rejects collection relation fields for %s elements', (type) => {
    expect(
      elementSchema.safeParse({
        ...createElement(type),
        answerCollectionRef: 'collection-0',
        answerCollectionItemRefs: ['item-0'],
      }).success
    ).toBe(false)
  })

  it.each([
    ElementType.SELECTION,
    ElementType.CASE_STUDY,
  ])('accepts applicable collection relation fields for %s elements', (type) => {
    expect(elementSchema.safeParse(createElement(type)).success).toBe(true)
  })

  it('requires collection relations for selection and case-study elements', () => {
    const selection = createElement(ElementType.SELECTION)
    delete selection.answerCollectionRef
    const caseStudy = createElement(ElementType.CASE_STUDY)
    delete caseStudy.answerCollectionItemRefs

    expect(elementSchema.safeParse(selection).success).toBe(false)
    expect(elementSchema.safeParse(caseStudy).success).toBe(false)
  })
})
