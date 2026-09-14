import {
  ElementStatus,
  ElementType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  ImportExportErrorCode,
  ImportExportWarningCode,
} from '../src/lib/importExportErrors.js'
import {
  createPackageMediaHref,
  IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER,
  measureElementMediaReferenceWork,
} from '../src/lib/importExportMediaReferences.js'
import {
  MAX_IMPORT_EXPORT_CONTENT_LENGTH,
  MAX_IMPORT_EXPORT_MEDIA_MARKDOWN_WORK_UNITS,
  MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
} from '../src/lib/importExportPackageConfig.js'
import { createZip } from '../src/lib/zip.js'
import type { ElementExportSnapshot } from '../src/services/elementExportSnapshot.js'
import {
  createPortableExportPlan,
  getStoredZipByteLength,
  PortableExportMediaOutcomeStatus,
  renderPortableExportPackage,
  type PortableExportMediaHrefClassifier,
  type PortableExportMediaOutcome,
} from '../src/services/portableExportPlan.js'

const FIRST_PARTY_IMAGE = 'https://media.test/owner/photo.png'
const FIRST_PARTY_ALIAS = 'https://media.test/owner/photo.png?download=1'
const OMITTED_FIRST_PARTY_IMAGE = 'https://media.test/owner/missing.png'
const EXTERNAL_IMAGE = 'https://external.test/image.png'
const CREATED_AT = '2026-07-13T10:00:00.000Z'

const classifyMediaHref: PortableExportMediaHrefClassifier = (href) => {
  if (href === FIRST_PARTY_IMAGE || href === FIRST_PARTY_ALIAS) {
    return { storageIdentity: 'owner/photo.png' }
  }
  if (href === OMITTED_FIRST_PARTY_IMAGE) {
    return { storageIdentity: 'owner/missing.png' }
  }
  return null
}

function choiceOptions(count: number) {
  return {
    displayMode: 'LIST',
    hasSampleSolution: false,
    hasAnswerFeedbacks: false,
    choices: Array.from({ length: count }, (_, ix) => ({
      ix,
      value: `Choice ${ix + 1}`,
    })),
  }
}

function optionsFor(type: ElementType) {
  switch (type) {
    case ElementType.SC:
    case ElementType.MC:
      return choiceOptions(2)
    case ElementType.KPRIM:
      return choiceOptions(4)
    case ElementType.FREE_TEXT:
      return { hasSampleSolution: false, restrictions: { maxLength: 100 } }
    case ElementType.NUMERICAL:
      return {
        hasSampleSolution: true,
        placeholder: '± 1.5',
        exactSolutions: [1.5],
      }
    case ElementType.SELECTION:
      return { hasSampleSolution: true, numberOfInputs: 1 }
    case ElementType.CASE_STUDY:
      return {
        hasSampleSolution: true,
        criteria: [
          {
            id: 'criterion-1',
            name: 'Quality',
            order: 0,
            min: 0,
            max: 5,
            step: 1,
          },
        ],
        cases: [
          {
            id: 'case-1',
            title: 'Case 1',
            description: `Case image ![alias](${FIRST_PARTY_ALIAS})`,
            order: 0,
            solutions: [
              {
                itemId: 1001,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 4, max: 5 },
                ],
              },
            ],
          },
        ],
      }
    case ElementType.CONTENT:
    case ElementType.FLASHCARD:
      return {}
  }
}

function createSnapshot(): ElementExportSnapshot {
  const types = [
    ElementType.SC,
    ElementType.MC,
    ElementType.KPRIM,
    ElementType.FREE_TEXT,
    ElementType.NUMERICAL,
    ElementType.CONTENT,
    ElementType.FLASHCARD,
    ElementType.SELECTION,
    ElementType.CASE_STUDY,
  ]
  const now = new Date('2026-07-13T09:00:00.000Z')
  const collectionEntries = [
    { id: 1001, value: 'Alpha', updatedAt: now },
    { id: 1002, value: 'Beta', updatedAt: now },
  ]

  const elements = types.map((type, index) => {
    const usesCollection =
      type === ElementType.SELECTION || type === ElementType.CASE_STUDY
    const content =
      type === ElementType.SC
        ? [
            `![packaged](${FIRST_PARTY_IMAGE})`,
            `[ordinary link](${FIRST_PARTY_IMAGE})`,
            `![external](${EXTERNAL_IMAGE})`,
          ].join('\n\n')
        : type === ElementType.MC
          ? `![alias](${FIRST_PARTY_ALIAS})`
          : type === ElementType.KPRIM
            ? `![missing](${OMITTED_FIRST_PARTY_IMAGE})`
            : `Portable ${type}`

    return {
      id: index + 1,
      name: `Element ${type}`,
      content,
      options: optionsFor(type),
      type,
      pointsMultiplier: 1,
      explanation:
        type === ElementType.FLASHCARD ? 'Flashcard explanation' : null,
      version: 1,
      status: ElementStatus.REVIEW,
      answerCollectionId: usesCollection ? 100 : null,
      basePoints:
        type !== ElementType.CONTENT && type !== ElementType.FLASHCARD,
      updatedAt: now,
      answerCollectionItems: usesCollection
        ? [
            {
              ...collectionEntries[0]!,
              collectionId: 100,
            },
          ]
        : [],
      exportPermission: PermissionLevel.OWNER,
    }
  })

  return {
    elements,
    answerCollections: [
      {
        id: 100,
        name: 'Portable pool',
        description: `Pool ![external](${EXTERNAL_IMAGE})`,
        version: 1,
        updatedAt: now,
        entries: collectionEntries,
        exportPermission: PermissionLevel.OWNER,
      },
    ],
    revision: {
      token: 'revision-token',
      elementIds: elements.map(({ id }) => id),
      answerCollectionIds: [100],
    },
  }
}

function mediaOutcomes(data?: Buffer): PortableExportMediaOutcome[] {
  const includedData = data ?? Buffer.from('portable media bytes')
  return [
    {
      storageIdentity: 'owner/photo.png',
      status: PortableExportMediaOutcomeStatus.INCLUDED,
      filename: 'Original Photo.PNG',
      contentType: 'image/png',
      bytes: includedData.length,
      sha256: createHash('sha256').update(includedData).digest('hex'),
      ...(data
        ? {
            data,
          }
        : {}),
    },
    {
      storageIdentity: 'owner/missing.png',
      status: PortableExportMediaOutcomeStatus.OMITTED,
    },
  ]
}

describe('portable export plan and archive rendering', () => {
  it.each([
    {
      source: 'element content link',
      mutate(snapshot: ElementExportSnapshot) {
        snapshot.elements[0]!.content =
          '[reserved](klicker-package-media://forged)'
      },
    },
    {
      source: 'element explanation link',
      mutate(snapshot: ElementExportSnapshot) {
        snapshot.elements[0]!.explanation =
          '[reserved](klicker-package-media://forged)'
      },
    },
    {
      source: 'element option link',
      mutate(snapshot: ElementExportSnapshot) {
        ;(snapshot.elements[0]!.options as any).choices[0].value =
          '[reserved](klicker-package-media://forged)'
      },
    },
    {
      source: 'answer-collection description link',
      mutate(snapshot: ElementExportSnapshot) {
        snapshot.answerCollections[0]!.description =
          '[reserved](klicker-package-media://forged)'
      },
    },
    {
      source: 'answer-entry plain URL',
      mutate(snapshot: ElementExportSnapshot) {
        snapshot.answerCollections[0]!.entries[0]!.value =
          'klicker-package-media://forged'
      },
    },
  ])('rejects a reserved transport reference in $source', ({ mutate }) => {
    const snapshot = createSnapshot()
    mutate(snapshot)

    expect(() =>
      createPortableExportPlan(snapshot, { classifyMediaHref })
    ).toThrow(
      expect.objectContaining({
        code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
      })
    )
  })

  it('maps JSON escaping beyond the file cap to element-not-portable', () => {
    const snapshot = createSnapshot()
    snapshot.elements[0]!.content = '\u0001'.repeat(
      MAX_IMPORT_EXPORT_CONTENT_LENGTH
    )
    snapshot.elements[0]!.explanation = '\u0001'.repeat(
      MAX_IMPORT_EXPORT_CONTENT_LENGTH
    )
    const plan = createPortableExportPlan(snapshot, { classifyMediaHref })

    expect(() =>
      renderPortableExportPackage({
        plan,
        mediaOutcomes: mediaOutcomes(),
        createdAt: CREATED_AT,
      })
    ).toThrow(
      expect.objectContaining({
        code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
      })
    )
  })

  it('rejects snapshots above the aggregate selected-item contract', () => {
    const snapshot = createSnapshot()
    snapshot.elements[7]!.answerCollectionItems = Array.from(
      {
        length: MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS + 1,
      },
      () => snapshot.elements[7]!.answerCollectionItems[0]!
    )

    expect(() =>
      createPortableExportPlan(snapshot, { classifyMediaHref })
    ).toThrow(
      expect.objectContaining({
        code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
      })
    )
  })

  it('accepts the occurrence boundary without changing ordinary links', () => {
    const snapshot = createSnapshot()
    const source = snapshot.elements.find(
      ({ type }) => type === ElementType.CONTENT
    )!
    const ordinaryUrl = 'https://external.test/guide'
    const content = Array.from(
      { length: MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES },
      () => ordinaryUrl
    ).join(' ')
    snapshot.elements = [
      {
        ...structuredClone(source),
        content,
      },
    ]
    snapshot.answerCollections = []
    snapshot.revision = {
      token: 'ordinary-link-boundary-revision',
      elementIds: [source.id],
      answerCollectionIds: [],
    }
    const instrumentedClassifier = vi.fn(classifyMediaHref)

    const plan = createPortableExportPlan(snapshot, {
      classifyMediaHref: instrumentedClassifier,
    })

    expect(
      measureElementMediaReferenceWork(plan.elements[0]!.content)
        .candidateOccurrences
    ).toBe(MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES)
    expect(plan.elements[0]!.content.content).toBe(content)
    expect(plan.mediaInventory).toEqual({ firstParty: [], external: [] })
    expect(instrumentedClassifier).not.toHaveBeenCalled()
  })

  it('rejects a near-10 MiB repeated-image source before media inventory work', () => {
    const snapshot = createSnapshot()
    const source = snapshot.elements.find(
      ({ type }) => type === ElementType.CONTENT
    )!
    const image = '![image](https://external.test/repeated.png)'
    const content = image
      .repeat(Math.ceil(MAX_IMPORT_EXPORT_CONTENT_LENGTH / image.length))
      .slice(0, MAX_IMPORT_EXPORT_CONTENT_LENGTH)
    const elementCount = 52
    snapshot.elements = Array.from({ length: elementCount }, (_, index) => ({
      ...structuredClone(source),
      id: index + 1,
      name: `Repeated image element ${index + 1}`,
      content,
    }))
    snapshot.answerCollections = []
    snapshot.revision = {
      token: 'repeated-image-revision',
      elementIds: snapshot.elements.map(({ id }) => id),
      answerCollectionIds: [],
    }
    const instrumentedClassifier = vi.fn(classifyMediaHref)
    const firstElementWork = measureElementMediaReferenceWork({
      type: source.type,
      content,
      explanation: source.explanation,
      options: source.options,
    })
    const sourceBytes = Buffer.byteLength(content) * elementCount
    const heapBefore = process.memoryUsage().heapUsed
    const startedAt = performance.now()

    expect(() =>
      createPortableExportPlan(snapshot, {
        classifyMediaHref: instrumentedClassifier,
      })
    ).toThrow(
      expect.objectContaining({
        code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
      })
    )

    const elapsedMs = performance.now() - startedAt
    const retainedHeapBytes = Math.max(
      0,
      process.memoryUsage().heapUsed - heapBefore
    )
    expect(sourceBytes).toBeLessThan(MAX_IMPORT_EXPORT_PACKAGE_BYTES)
    expect(sourceBytes).toBeGreaterThan(9.9 * 1024 * 1024)
    expect(firstElementWork).toEqual({
      candidateOccurrences: 9092,
      markdownWorkUnits: 22_729,
    })
    expect(firstElementWork.candidateOccurrences).toBeGreaterThan(
      MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES
    )
    expect(elapsedMs).toBeLessThan(2_000)
    expect(retainedHeapBytes).toBeLessThan(64 * 1024 * 1024)
    expect(instrumentedClassifier).not.toHaveBeenCalled()
  })

  it('rejects dense Markdown delimiter work before parsing one ordinary URL', () => {
    const snapshot = createSnapshot()
    const source = snapshot.elements.find(
      ({ type }) => type === ElementType.CONTENT
    )!
    const ordinaryUrl = 'https://external.test/guide'
    const denseMarkdown = `${'*a*'.repeat(
      Math.floor(
        (MAX_IMPORT_EXPORT_CONTENT_LENGTH - ordinaryUrl.length - 1) / 3
      )
    )} ${ordinaryUrl}`
    snapshot.elements = [
      {
        ...structuredClone(source),
        content: denseMarkdown,
      },
    ]
    snapshot.answerCollections = []
    snapshot.revision = {
      token: 'dense-markdown-revision',
      elementIds: [source.id],
      answerCollectionIds: [],
    }
    const instrumentedClassifier = vi.fn(classifyMediaHref)
    const work = measureElementMediaReferenceWork({
      type: source.type,
      content: denseMarkdown,
      explanation: source.explanation,
      options: source.options,
    })
    const startedAt = performance.now()

    expect(() =>
      createPortableExportPlan(snapshot, {
        classifyMediaHref: instrumentedClassifier,
      })
    ).toThrow(
      expect.objectContaining({
        code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
      })
    )

    expect(work).toEqual({
      candidateOccurrences: 1,
      markdownWorkUnits: 133_314,
    })
    expect(work.markdownWorkUnits).toBeGreaterThan(
      MAX_IMPORT_EXPORT_MEDIA_MARKDOWN_WORK_UNITS
    )
    expect(performance.now() - startedAt).toBeLessThan(500)
    expect(instrumentedClassifier).not.toHaveBeenCalled()
  })

  it('stops rendering at the running archive cap before later files allocate', () => {
    const snapshot = createSnapshot()
    const source = snapshot.elements[0]!
    const normalElementCount =
      Math.ceil(
        MAX_IMPORT_EXPORT_PACKAGE_BYTES / MAX_IMPORT_EXPORT_CONTENT_LENGTH
      ) + 2
    const normalElements = Array.from(
      { length: normalElementCount },
      (_, index) => ({
        ...structuredClone(source),
        id: index + 1,
        name: `Aggregate render element ${index + 1}`,
        content: 'x'.repeat(MAX_IMPORT_EXPORT_CONTENT_LENGTH),
        explanation: null,
      })
    )
    snapshot.elements = [
      ...normalElements,
      {
        ...structuredClone(source),
        id: normalElementCount + 1,
        name: 'Late escape-expanded element',
        content: '\u0001'.repeat(MAX_IMPORT_EXPORT_CONTENT_LENGTH),
        explanation: '\u0001'.repeat(MAX_IMPORT_EXPORT_CONTENT_LENGTH),
      },
    ]
    snapshot.answerCollections = []
    snapshot.revision = {
      token: 'aggregate-render-revision',
      elementIds: snapshot.elements.map(({ id }) => id),
      answerCollectionIds: [],
    }
    const plan = createPortableExportPlan(snapshot, { classifyMediaHref })

    expect(() =>
      renderPortableExportPackage({
        plan,
        mediaOutcomes: [],
        createdAt: CREATED_AT,
      })
    ).toThrow(
      expect.objectContaining({
        code: ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE,
      })
    )
  })

  it('owns immutable canonical payloads and deterministic media inventory for all nine element types', () => {
    const first = createPortableExportPlan(createSnapshot(), {
      classifyMediaHref,
    })
    const second = createPortableExportPlan(createSnapshot(), {
      classifyMediaHref,
    })

    expect(first.elements.map(({ content }) => content.type)).toEqual([
      ElementType.SC,
      ElementType.MC,
      ElementType.KPRIM,
      ElementType.FREE_TEXT,
      ElementType.NUMERICAL,
      ElementType.CONTENT,
      ElementType.FLASHCARD,
      ElementType.SELECTION,
      ElementType.CASE_STUDY,
    ])
    expect(first.answerCollections).toHaveLength(1)
    expect(first.elements[7]?.content).toMatchObject({
      answerCollectionRef: 'answer-collection-1',
      answerCollectionItemRefs: ['answer-collection-1-entry-1'],
    })
    expect(first.elements[8]?.content.options).toMatchObject({
      cases: [
        {
          solutions: [
            {
              itemRef: 'answer-collection-1-entry-1',
            },
          ],
        },
      ],
    })
    expect(first.mediaInventory).toEqual({
      firstParty: [
        {
          storageIdentity: 'owner/missing.png',
          href: OMITTED_FIRST_PARTY_IMAGE,
          aliases: [OMITTED_FIRST_PARTY_IMAGE],
        },
        {
          storageIdentity: 'owner/photo.png',
          href: FIRST_PARTY_IMAGE,
          aliases: [FIRST_PARTY_IMAGE, FIRST_PARTY_ALIAS].sort(),
        },
      ],
      external: [{ href: EXTERNAL_IMAGE }],
    })
    expect(first).toEqual(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.elements)).toBe(true)
    expect(Object.isFrozen(first.elements[0]?.content)).toBe(true)
  })

  it('uses one render operation for preview and hydrated media with reference-kind-aware omissions', () => {
    const plan = createPortableExportPlan(createSnapshot(), {
      classifyMediaHref,
    })
    const data = Buffer.from('portable media bytes')
    const preview = renderPortableExportPackage({
      plan,
      mediaOutcomes: mediaOutcomes(),
      createdAt: CREATED_AT,
    })
    const hydrated = renderPortableExportPackage({
      plan,
      mediaOutcomes: [...mediaOutcomes(data)].reverse(),
      createdAt: CREATED_AT,
    })

    expect(preview.isHydrated).toBe(false)
    expect(hydrated.isHydrated).toBe(true)
    expect(hydrated.mediaFiles[0]?.data).toEqual(data)
    expect(preview.warnings).toEqual([
      ImportExportWarningCode.EXTERNAL_MEDIA,
      ImportExportWarningCode.MEDIA_NOT_INCLUDED,
    ])
    expect(hydrated.warnings).toEqual(preview.warnings)
    expect(hydrated.manifest.media[0]?.sha256).toBe(
      createHash('sha256').update(data).digest('hex')
    )
    expect(preview.manifest.media[0]?.sha256).toBe(
      createHash('sha256').update(data).digest('hex')
    )
    expect({
      ...hydrated.manifest,
      media: hydrated.manifest.media.map(
        ({ sha256: _sha256, ...entry }) => entry
      ),
    }).toEqual({
      ...preview.manifest,
      media: preview.manifest.media.map(
        ({ sha256: _sha256, ...entry }) => entry
      ),
    })
    expect(hydrated.elementFiles.map(({ content }) => content)).toEqual(
      preview.elementFiles.map(({ content }) => content)
    )
    expect(
      hydrated.answerCollectionFiles.map(({ content }) => content)
    ).toEqual(preview.answerCollectionFiles.map(({ content }) => content))
    expect(hydrated.files.map(({ path, bytes }) => ({ path, bytes }))).toEqual(
      preview.files.map(({ path, bytes }) => ({ path, bytes }))
    )
    expect(hydrated.storedZipBytes).toBe(preview.storedZipBytes)

    const choiceContent = hydrated.elementFiles[0]!.content.content
    expect(choiceContent).toContain(createPackageMediaHref('media-1'))
    expect(choiceContent).toContain(`[ordinary link](${FIRST_PARTY_IMAGE})`)
    expect(choiceContent).toContain(IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER)
    expect(choiceContent).not.toContain(`![external](${EXTERNAL_IMAGE})`)
    expect(hydrated.elementFiles[2]!.content.content).toContain(
      IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
    )
    expect(hydrated.elementFiles[1]!.content.content).toContain(
      createPackageMediaHref('media-1')
    )
    expect(hydrated.elementFiles[8]!.content.options).toMatchObject({
      cases: [
        {
          description: expect.stringContaining(
            createPackageMediaHref('media-1')
          ),
        },
      ],
    })
  })

  it('accounts for the exact stored ZIP bytes using the rendered file order and data', () => {
    const data = Buffer.from('non-empty hydrated media')
    const rendered = renderPortableExportPackage({
      plan: createPortableExportPlan(createSnapshot(), {
        classifyMediaHref,
      }),
      mediaOutcomes: mediaOutcomes(data),
      createdAt: CREATED_AT,
    })
    const archiveFiles = rendered.files.map(({ path, data: fileData }) => {
      if (!fileData) throw new Error(`Missing hydrated data for ${path}`)
      return { path, data: fileData }
    })
    const archive = createZip(archiveFiles)

    expect(rendered.files.map(({ path }) => path)).toEqual([
      'manifest.json',
      'answer-collections/answer-collection-1.json',
      ...Array.from(
        { length: 9 },
        (_, index) => `elements/element-${index + 1}.json`
      ),
      'media/media-1.png',
    ])
    expect(getStoredZipByteLength(rendered.files)).toBe(archive.length)
    expect(rendered.storedZipBytes).toBe(archive.length)
  })
})
