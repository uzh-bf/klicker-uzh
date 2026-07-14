import { ElementType, PermissionLevel } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../src/lib/importExportErrors.js'
import { measureElementMediaReferenceWork } from '../src/lib/importExportMediaReferences.js'
import {
  MAX_IMPORT_EXPORT_CONTENT_LENGTH,
  MAX_IMPORT_EXPORT_JSON_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_BYTES,
  MAX_IMPORT_EXPORT_MEDIA_MARKDOWN_WORK_UNITS,
  MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES,
  MAX_IMPORT_EXPORT_OPTIONS_BYTES,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
} from '../src/lib/importExportPackageConfig.js'
import { createZip } from '../src/lib/zip.js'
import {
  createElementExportPackage,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'

const { recordMarkdownParse } = vi.hoisted(() => ({
  recordMarkdownParse: vi.fn(),
}))

vi.mock('mdast-util-from-markdown', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('mdast-util-from-markdown')>()
  return {
    ...actual,
    fromMarkdown: (...args: Parameters<typeof actual.fromMarkdown>) => {
      recordMarkdownParse()
      return actual.fromMarkdown(...args)
    },
  }
})

type PackageFile = { path: string; data: Buffer | string }

function manifestFile(overrides: Record<string, unknown> = {}) {
  return {
    type: 'klicker-element-package',
    version: 3,
    createdAt: '2026-07-12T00:00:00.000Z',
    elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
    answerCollections: [],
    media: [],
    ...overrides,
  }
}

function jsonAtExactByteLength(value: unknown, bytes: number) {
  const json = JSON.stringify(value)
  const paddingBytes = bytes - Buffer.byteLength(json, 'utf8')
  if (paddingBytes < 0) throw new Error('JSON fixture exceeds target size.')

  return Buffer.from(json + ' '.repeat(paddingBytes), 'utf8')
}

function replaceFirstMarkerByteWithInvalidUtf8(value: unknown, marker: string) {
  const buffer = Buffer.from(JSON.stringify(value), 'utf8')
  const offset = buffer.indexOf(Buffer.from(marker, 'utf8'))
  if (offset < 0) throw new Error(`Fixture marker not found: ${marker}`)
  buffer[offset] = 0xff
  return buffer
}

function elementFile(content = 'Portable content') {
  return {
    ref: 'element-1',
    name: 'Portable element',
    content,
    type: ElementType.SC,
    options: {
      displayMode: 'LIST',
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: [
        { ix: 0, value: 'A' },
        { ix: 1, value: 'B' },
      ],
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
  }
}

function packageBuffer({
  manifest = {},
  element = elementFile(),
  manifestData,
  elementData,
  files = [],
}: {
  manifest?: Record<string, unknown>
  element?: Record<string, unknown>
  manifestData?: Buffer | string
  elementData?: Buffer | string
  files?: PackageFile[]
} = {}) {
  return createZip([
    {
      path: 'manifest.json',
      data: manifestData ?? JSON.stringify(manifestFile(manifest)),
    },
    {
      path: 'elements/element-1.json',
      data: elementData ?? JSON.stringify(element),
    },
    ...files,
  ])
}

function answerCollection(ref: string, count: number) {
  return {
    ref,
    name: ref,
    description: '',
    entries: Array.from({ length: count }, (_, index) => ({
      ref: `${ref}-entry-${index + 1}`,
      value: `${ref} value ${index + 1}`,
    })),
  }
}

function packageWithCollections(entryCounts: number[]) {
  const collections = entryCounts.map((count, index) =>
    answerCollection(`collection-${index + 1}`, count)
  )

  return packageBuffer({
    manifest: {
      answerCollections: collections.map((collection) => ({
        ref: collection.ref,
        file: `answer-collections/${collection.ref}.json`,
      })),
    },
    files: collections.map((collection) => ({
      path: `answer-collections/${collection.ref}.json`,
      data: JSON.stringify(collection),
    })),
  })
}

function packageWithSelectedRelationCounts(
  selectedCounts: number[],
  { hasSampleSolution = true }: { hasSampleSolution?: boolean } = {}
) {
  const collection = answerCollection('collection-1', 2_000)
  const elements = selectedCounts.map((selectedCount, index) => ({
    ref: `selection-${index + 1}`,
    name: `Selection ${index + 1}`,
    content: 'Select the applicable answers.',
    type: ElementType.SELECTION,
    options: { hasSampleSolution, numberOfInputs: 1 },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    answerCollectionRef: collection.ref,
    answerCollectionItemRefs: collection.entries
      .slice(0, selectedCount)
      .map(({ ref }) => ref),
  }))

  return createZip([
    {
      path: 'manifest.json',
      data: JSON.stringify(
        manifestFile({
          elements: elements.map((element) => ({
            ref: element.ref,
            file: `elements/${element.ref}.json`,
            answerCollectionRef: collection.ref,
          })),
          answerCollections: [
            {
              ref: collection.ref,
              file: `answer-collections/${collection.ref}.json`,
            },
          ],
        })
      ),
    },
    {
      path: `answer-collections/${collection.ref}.json`,
      data: JSON.stringify(collection),
    },
    ...elements.map((element) => ({
      path: `elements/${element.ref}.json`,
      data: JSON.stringify(element),
    })),
  ])
}

function packageWithElementContents(contents: readonly string[]) {
  const elements = contents.map((content, index) => {
    const ref = `element-${index + 1}`
    return {
      ...elementFile(content),
      ref,
      name: `Element ${index + 1}`,
    }
  })

  return createZip([
    {
      path: 'manifest.json',
      data: JSON.stringify(
        manifestFile({
          elements: elements.map(({ ref }) => ({
            ref,
            file: `elements/${ref}.json`,
          })),
        })
      ),
    },
    ...elements.map((element) => ({
      path: `elements/${element.ref}.json`,
      data: JSON.stringify(element),
    })),
  ])
}

function expectImportError(buffer: Buffer, code: ImportExportErrorCode) {
  let thrown: unknown
  try {
    validateElementImportPackageBuffer(buffer)
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(ImportExportDomainError)
  expect(thrown).toMatchObject({ code })
}

function optionsAtExactByteLength(bytes: number) {
  const options = {
    displayMode: 'LIST',
    hasSampleSolution: false,
    hasAnswerFeedbacks: false,
    choices: [{ ix: 0, value: '' }],
  }
  const serializedBytes = Buffer.byteLength(JSON.stringify(options), 'utf8')
  options.choices[0]!.value = 'x'.repeat(bytes - serializedBytes)

  expect(Buffer.byteLength(JSON.stringify(options), 'utf8')).toBe(bytes)
  return options
}

function mediaEntry(data: Buffer, overrides: Record<string, unknown> = {}) {
  return {
    ref: 'media-1',
    file: 'media/media-1.png',
    filename: 'media-1.png',
    contentType: 'image/png',
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
    sourceHref: 'klicker-package-media://media-1',
    ...overrides,
  }
}

describe('element import/export aggregate and media closure boundaries', () => {
  it('accepts a manifest at the JSON byte cap and rejects one byte more', () => {
    const manifest = manifestFile()
    expect(
      validateElementImportPackageBuffer(
        packageBuffer({
          manifestData: jsonAtExactByteLength(
            manifest,
            MAX_IMPORT_EXPORT_JSON_BYTES
          ),
        })
      ).normalizedPackage.elements
    ).toHaveLength(1)

    expectImportError(
      packageBuffer({
        manifestData: jsonAtExactByteLength(
          manifest,
          MAX_IMPORT_EXPORT_JSON_BYTES + 1
        ),
      }),
      ImportExportErrorCode.PACKAGE_TOO_LARGE
    )
  })

  it('accepts an element JSON file at the byte cap and rejects one byte more', () => {
    const element = elementFile()
    expect(
      validateElementImportPackageBuffer(
        packageBuffer({
          elementData: jsonAtExactByteLength(
            element,
            MAX_IMPORT_EXPORT_JSON_BYTES
          ),
        })
      ).normalizedPackage.elements
    ).toHaveLength(1)

    expectImportError(
      packageBuffer({
        elementData: jsonAtExactByteLength(
          element,
          MAX_IMPORT_EXPORT_JSON_BYTES + 1
        ),
      }),
      ImportExportErrorCode.PACKAGE_TOO_LARGE
    )
  })

  it('rejects malformed UTF-8 in element and manifest JSON', () => {
    expectImportError(
      packageBuffer({
        elementData: replaceFirstMarkerByteWithInvalidUtf8(
          elementFile('Question'),
          'Question'
        ),
      }),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportError(
      packageBuffer({
        manifestData: replaceFirstMarkerByteWithInvalidUtf8(
          manifestFile(),
          '2026-07-12'
        ),
      }),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('accepts element options at the byte cap and rejects one byte more', () => {
    expect(
      validateElementImportPackageBuffer(
        packageBuffer({
          element: {
            ...elementFile(),
            options: optionsAtExactByteLength(MAX_IMPORT_EXPORT_OPTIONS_BYTES),
          },
        })
      ).normalizedPackage.elements
    ).toHaveLength(1)

    expectImportError(
      packageBuffer({
        element: {
          ...elementFile(),
          options: optionsAtExactByteLength(
            MAX_IMPORT_EXPORT_OPTIONS_BYTES + 1
          ),
        },
      }),
      ImportExportErrorCode.PACKAGE_TOO_LARGE
    )
  })

  it('maps a declared media byte count above the cap to package-too-large', () => {
    const data = Buffer.alloc(0)
    expectImportError(
      packageBuffer({
        manifest: {
          media: [
            mediaEntry(data, { bytes: MAX_IMPORT_EXPORT_MEDIA_BYTES + 1 }),
          ],
        },
      }),
      ImportExportErrorCode.PACKAGE_TOO_LARGE
    )
  })

  it('accepts a media file at the byte cap and rejects one byte more', () => {
    const maximum = Buffer.alloc(MAX_IMPORT_EXPORT_MEDIA_BYTES)
    const maximumEntry = mediaEntry(maximum)
    expect(
      validateElementImportPackageBuffer(
        packageBuffer({
          manifest: { media: [maximumEntry] },
          files: [{ path: maximumEntry.file, data: maximum }],
        })
      ).normalizedPackage.media
    ).toHaveLength(1)

    const oversized = Buffer.alloc(MAX_IMPORT_EXPORT_MEDIA_BYTES + 1)
    const oversizedEntry = mediaEntry(oversized, {
      bytes: MAX_IMPORT_EXPORT_MEDIA_BYTES,
    })
    expectImportError(
      packageBuffer({
        manifest: { media: [oversizedEntry] },
        files: [{ path: oversizedEntry.file, data: oversized }],
      }),
      ImportExportErrorCode.PACKAGE_TOO_LARGE
    )
  })

  it('rejects SVG media on import', () => {
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
    const entry = mediaEntry(data, {
      file: 'media/media-1.svg',
      filename: 'media-1.svg',
      contentType: 'image/svg+xml',
    })

    expectImportError(
      packageBuffer({
        manifest: { media: [entry] },
        files: [{ path: entry.file, data }],
      }),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('accepts 5,000 total entries and rejects 5,001', () => {
    const maximum = validateElementImportPackageBuffer(
      packageWithCollections([2000, 2000, 1000])
    )

    expect(maximum.normalizedPackage.answerCollections).toHaveLength(3)
    expect(
      maximum.normalizedPackage.answerCollections.reduce(
        (total, collection) => total + collection.entries.length,
        0
      )
    ).toBe(5000)

    expectImportError(
      packageWithCollections([2000, 2000, 1001]),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )
  })

  it('accepts 5,000 selected relations and rejects 5,001 before preview construction', () => {
    const maximum = validateElementImportPackageBuffer(
      packageWithSelectedRelationCounts([2_000, 2_000, 1_000])
    )
    expect(
      maximum.normalizedPackage.elements.reduce(
        (total, element) =>
          total + (element.answerCollectionItemRefs?.length ?? 0),
        0
      )
    ).toBe(MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS)

    expectImportError(
      packageWithSelectedRelationCounts([2_000, 2_000, 1_001]),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )
  })

  it('accepts the media-reference boundary and preserves ordinary links', () => {
    const ordinaryUrl = 'https://external.test/guide'
    const content = Array.from(
      { length: MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES },
      () => ordinaryUrl
    ).join(' ')
    const parserCallsBefore = recordMarkdownParse.mock.calls.length

    const result = validateElementImportPackageBuffer(
      packageWithElementContents([content])
    )

    expect(
      measureElementMediaReferenceWork(result.normalizedPackage.elements[0]!)
    ).toEqual({
      candidateOccurrences: MAX_IMPORT_EXPORT_MEDIA_REFERENCE_OCCURRENCES,
      markdownWorkUnits: 0,
    })
    expect(result.normalizedPackage.elements[0]!.content).toBe(content)
    expect(result.warnings).toEqual(['IMPORT_STATUS_NORMALIZED_TO_REVIEW'])
    expect(recordMarkdownParse.mock.calls.length).toBeGreaterThan(
      parserCallsBefore
    )
  })

  it('rejects a near-limit repeated-image package before Markdown parsing', () => {
    const image = '![image](https://external.test/repeated.png)'
    const content = image
      .repeat(Math.ceil(MAX_IMPORT_EXPORT_CONTENT_LENGTH / image.length))
      .slice(0, MAX_IMPORT_EXPORT_CONTENT_LENGTH)
    const elementCount = 51
    const buffer = packageWithElementContents(
      Array.from({ length: elementCount }, () => content)
    )
    const parserCallsBefore = recordMarkdownParse.mock.calls.length
    const heapBefore = process.memoryUsage().heapUsed
    const startedAt = performance.now()

    expectImportError(buffer, ImportExportErrorCode.AGGREGATE_LIMIT)

    const elapsedMs = performance.now() - startedAt
    const retainedHeapBytes = Math.max(
      0,
      process.memoryUsage().heapUsed - heapBefore
    )
    expect(buffer.length).toBeLessThan(MAX_IMPORT_EXPORT_PACKAGE_BYTES)
    expect(buffer.length).toBeGreaterThan(9.7 * 1024 * 1024)
    expect(
      measureElementMediaReferenceWork({
        ...elementFile(content),
        type: ElementType.SC,
      })
    ).toEqual({
      candidateOccurrences: 9092,
      markdownWorkUnits: 22_729,
    })
    expect(elapsedMs).toBeLessThan(2_000)
    expect(retainedHeapBytes).toBeLessThan(96 * 1024 * 1024)
    expect(recordMarkdownParse).toHaveBeenCalledTimes(parserCallsBefore)
  })

  it('rejects dense Markdown work before parsing its one ordinary URL', () => {
    const ordinaryUrl = 'https://external.test/guide'
    const content = `${'*a*'.repeat(
      Math.floor(
        (MAX_IMPORT_EXPORT_CONTENT_LENGTH - ordinaryUrl.length - 1) / 3
      )
    )} ${ordinaryUrl}`
    const parserCallsBefore = recordMarkdownParse.mock.calls.length
    const startedAt = performance.now()

    expectImportError(
      packageWithElementContents([content]),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )

    expect(
      measureElementMediaReferenceWork({
        ...elementFile(content),
        type: ElementType.SC,
      })
    ).toEqual({
      candidateOccurrences: 1,
      markdownWorkUnits: 133_314,
    })
    expect(133_314).toBeGreaterThan(MAX_IMPORT_EXPORT_MEDIA_MARKDOWN_WORK_UNITS)
    expect(performance.now() - startedAt).toBeLessThan(500)
    expect(recordMarkdownParse).toHaveBeenCalledTimes(parserCallsBefore)
  })

  it('bounds dormant selected refs before domain normalization can strip them', () => {
    const maximum = validateElementImportPackageBuffer(
      packageWithSelectedRelationCounts([2_000, 2_000, 1_000], {
        hasSampleSolution: false,
      })
    )
    expect(
      maximum.normalizedPackage.elements.reduce(
        (total, element) =>
          total + (element.answerCollectionItemRefs?.length ?? 0),
        0
      )
    ).toBe(0)

    expectImportError(
      packageWithSelectedRelationCounts([2_000, 2_000, 1_001], {
        hasSampleSolution: false,
      }),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )
  })

  it('classifies per-resource and manifest count breaches as aggregate limits', () => {
    expectImportError(
      packageWithCollections([2001]),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )

    const elementDeclarations = Array.from({ length: 101 }, (_, index) => ({
      ref: `element-${index + 1}`,
      file: `elements/element-${index + 1}.json`,
    }))
    expectImportError(
      packageBuffer({ manifest: { elements: elementDeclarations } }),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )

    const collectionDeclarations = Array.from({ length: 51 }, (_, index) => ({
      ref: `collection-${index + 1}`,
      file: `answer-collections/collection-${index + 1}.json`,
    }))
    expectImportError(
      packageBuffer({
        manifest: { answerCollections: collectionDeclarations },
      }),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )

    const mediaDeclarations = Array.from({ length: 101 }, (_, index) => ({
      ref: `media-${index + 1}`,
      file: `media/media-${index + 1}.png`,
      filename: `media-${index + 1}.png`,
      contentType: 'image/png',
      bytes: 1,
      sha256: index.toString(16).padStart(64, '0'),
      sourceHref: `klicker-package-media://media-${index + 1}`,
    }))
    expectImportError(
      packageBuffer({ manifest: { media: mediaDeclarations } }),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )

    expectImportError(
      packageBuffer({
        manifest: {
          warnings: Array.from(
            { length: 201 },
            () => 'IMPORT_STATUS_NORMALIZED_TO_REVIEW'
          ),
        },
      }),
      ImportExportErrorCode.AGGREGATE_LIMIT
    )
  })

  it('classifies export entry-count breaches as export aggregate limits', async () => {
    function exportFixture(
      entryCounts: number[],
      elementsPerCollection = 1,
      selectAllEntries = false
    ) {
      const collections = entryCounts.map((count, collectionIndex) => ({
        id: collectionIndex + 1,
        name: `Collection ${collectionIndex + 1}`,
        description: '',
        version: 42,
        updatedAt: new Date(0),
        permissions: [{ permissionLevel: PermissionLevel.OWNER }],
        entries: Array.from({ length: count }, (_, entryIndex) => ({
          id: (collectionIndex + 1) * 10_000 + entryIndex,
          value: `Entry ${collectionIndex + 1}-${entryIndex + 1}`,
          updatedAt: new Date(0),
        })),
      }))
      let nextElementId = 1
      const elements = collections.flatMap((collection, collectionIndex) =>
        Array.from({ length: elementsPerCollection }, (_, elementIndex) => ({
          id: nextElementId++,
          name: `Selection ${collectionIndex + 1}-${elementIndex + 1}`,
          content: 'Select an entry',
          type: ElementType.SELECTION,
          options: {
            hasSampleSolution: selectAllEntries,
            numberOfInputs: 1,
          },
          pointsMultiplier: 1,
          basePoints: true,
          explanation: null,
          version: 1,
          status: 'READY',
          answerCollectionId: collection.id,
          answerCollectionItems: selectAllEntries ? collection.entries : [],
          updatedAt: new Date(0),
          permissions: [{ permissionLevel: PermissionLevel.OWNER }],
        }))
      )

      let rawQueryCount = 0
      const prisma = {
        element: {
          findMany: async (args: { select?: { _count?: unknown } }) =>
            args.select?._count
              ? elements.map((element) => ({
                  id: element.id,
                  _count: {
                    answerCollectionItems: element.answerCollectionItems.length,
                  },
                }))
              : elements,
        },
        answerCollection: {
          findMany: async (args: { select?: { _count?: unknown } }) =>
            args.select?._count
              ? collections.map((collection) => ({
                  id: collection.id,
                  _count: { entries: collection.entries.length },
                }))
              : collections,
        },
        $queryRaw: async () => {
          rawQueryCount += 1
          return rawQueryCount === 1
            ? elements.map((element) => ({
                id: element.id,
                nameLength: element.name.length,
                contentLength: element.content.length,
                explanationLength: 0,
                optionsTextBytes: Buffer.byteLength(
                  JSON.stringify(element.options),
                  'utf8'
                ),
                sourceBytes: BigInt(
                  Buffer.byteLength(
                    `${element.name}${element.content}${JSON.stringify(element.options)}`,
                    'utf8'
                  )
                ),
              }))
            : rawQueryCount === 2
              ? [
                  {
                    maximumValueLength: Math.max(
                      ...elements.flatMap((element) =>
                        element.answerCollectionItems.map(
                          (entry) => entry.value.length
                        )
                      ),
                      0
                    ),
                    sourceBytes: BigInt(
                      elements.reduce(
                        (total, element) =>
                          total +
                          element.answerCollectionItems.reduce(
                            (itemTotal, entry) =>
                              itemTotal +
                              Buffer.byteLength(entry.value, 'utf8'),
                            0
                          ),
                        0
                      )
                    ),
                  },
                ]
              : collections.map((collection) => ({
                  id: collection.id,
                  nameLength: collection.name.length,
                  descriptionLength: collection.description.length,
                  maximumEntryValueLength: Math.max(
                    ...collection.entries.map((entry) => entry.value.length)
                  ),
                  sourceBytes: BigInt(
                    Buffer.byteLength(
                      `${collection.name}${collection.description}${collection.entries.map((entry) => entry.value).join('')}`,
                      'utf8'
                    )
                  ),
                }))
        },
        $transaction: async (callback: (tx: unknown) => unknown) =>
          await callback(prisma),
      }

      return {
        elementIds: elements.map((element) => element.id),
        ctx: {
          user: { sub: 'owner' },
          prisma,
        },
      }
    }

    for (const entryCounts of [[2001], [2000, 2000, 1001]]) {
      const fixture = exportFixture(entryCounts)
      await expect(
        createElementExportPackage(
          { elementIds: fixture.elementIds },
          fixture.ctx as any
        )
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
      })
    }

    const repeatedSelections = exportFixture([2000], 2, true)
    await expect(
      createElementExportPackage(
        { elementIds: repeatedSelections.elementIds },
        repeatedSelections.ctx as any
      )
    ).resolves.toMatchObject({ buffer: expect.any(Buffer) })
  })

  it('requires at least one element', () => {
    expectImportError(
      packageBuffer({ manifest: { elements: [] } }),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('deduplicates bounded package warnings but derives its own warnings', () => {
    const result = validateElementImportPackageBuffer(
      packageBuffer({
        manifest: {
          warnings: Array.from({ length: 200 }, () => 'IMPORT_CLEANUP_PENDING'),
        },
      })
    )

    expect(result.normalizedPackage.manifest.warnings).toEqual([
      'IMPORT_CLEANUP_PENDING',
    ])
    expect(result.warnings).toEqual(['IMPORT_STATUS_NORMALIZED_TO_REVIEW'])
  })

  it('rejects undeclared package media references', () => {
    expectImportError(
      packageBuffer({
        element: elementFile(
          'Missing image ![media](klicker-package-media://missing-media)'
        ),
      }),
      ImportExportErrorCode.INVALID_PACKAGE
    )

    const collection = {
      ...answerCollection('collection-1', 1),
      description:
        'Missing collection image ![media](klicker-package-media://missing-media)',
    }
    expectImportError(
      packageBuffer({
        manifest: {
          answerCollections: [
            {
              ref: collection.ref,
              file: 'answer-collections/collection-1.json',
            },
          ],
        },
        files: [
          {
            path: 'answer-collections/collection-1.json',
            data: JSON.stringify(collection),
          },
        ],
      }),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('includes collection descriptions in exact media closure and warnings', () => {
    const data = Buffer.from('collection image')
    const media = mediaEntry(data)
    const collection = {
      ...answerCollection('collection-1', 1),
      description: `![collection image](${media.sourceHref})`,
    }
    const result = validateElementImportPackageBuffer(
      packageBuffer({
        manifest: {
          answerCollections: [
            {
              ref: collection.ref,
              file: 'answer-collections/collection-1.json',
            },
          ],
          media: [media],
        },
        files: [
          {
            path: 'answer-collections/collection-1.json',
            data: JSON.stringify(collection),
          },
          { path: media.file, data },
        ],
      })
    )

    expect(result.warnings).toEqual(['IMPORT_STATUS_NORMALIZED_TO_REVIEW'])
  })

  it('warns for external auto-loading media in collection descriptions', () => {
    const collection = {
      ...answerCollection('collection-1', 1),
      description: '![external](//attacker.example.test/collection-pixel.png)',
    }
    const result = validateElementImportPackageBuffer(
      packageBuffer({
        manifest: {
          answerCollections: [
            {
              ref: collection.ref,
              file: 'answer-collections/collection-1.json',
            },
          ],
        },
        files: [
          {
            path: 'answer-collections/collection-1.json',
            data: JSON.stringify(collection),
          },
        ],
      })
    )

    expect(result.warnings).toEqual([
      'IMPORT_STATUS_NORMALIZED_TO_REVIEW',
      'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED',
    ])
  })

  it('warns once for declared-but-unused media', () => {
    const data = Buffer.from('unused media')
    const sha256 = createHash('sha256').update(data).digest('hex')
    const result = validateElementImportPackageBuffer(
      packageBuffer({
        manifest: {
          media: [
            {
              ref: 'media-1',
              file: 'media/media-1.png',
              filename: 'media-1.png',
              contentType: 'image/png',
              bytes: data.length,
              sha256,
              sourceHref: 'klicker-package-media://media-1',
            },
          ],
        },
        files: [{ path: 'media/media-1.png', data }],
      })
    )

    expect(result.warnings).toEqual([
      'IMPORT_STATUS_NORMALIZED_TO_REVIEW',
      'IMPORT_UNUSED_MEDIA',
    ])
  })

  it('accepts distinct bounded media files with identical contents', () => {
    const data = Buffer.from('duplicate media')
    const sha256 = createHash('sha256').update(data).digest('hex')
    const media = [1, 2].map((index) => ({
      ref: `media-${index}`,
      file: `media/media-${index}.png`,
      filename: `media-${index}.png`,
      contentType: 'image/png',
      bytes: data.length,
      sha256,
      sourceHref: `klicker-package-media://media-${index}`,
    }))

    expect(
      validateElementImportPackageBuffer(
        packageBuffer({
          manifest: { media },
          element: elementFile(
            media.map((entry) => `![media](${entry.sourceHref})`).join('\n')
          ),
          files: media.map((entry) => ({ path: entry.file, data })),
        })
      ).normalizedPackage.media
    ).toHaveLength(2)
  })

  it('does not treat ordinary external links as auto-loading media', () => {
    const result = validateElementImportPackageBuffer(
      packageBuffer({
        element: elementFile(
          '[External reading](https://example.com/reference.pdf)'
        ),
      })
    )

    expect(result.warnings).toEqual(['IMPORT_STATUS_NORMALIZED_TO_REVIEW'])
  })

  it('handles deeply nested scheme-relative images as external auto-loads', () => {
    const result = validateElementImportPackageBuffer(
      packageBuffer({
        element: elementFile(
          `${'> '.repeat(3000)}![pixel](//attacker.example.test/pixel.png)`
        ),
      })
    )

    expect(result.warnings).toEqual([
      'IMPORT_STATUS_NORMALIZED_TO_REVIEW',
      'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED',
    ])
  })
})
