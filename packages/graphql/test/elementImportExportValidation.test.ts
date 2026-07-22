import { ElementStatus, ElementType } from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER } from '../src/lib/importExportMediaReferences.js'
import { parseZip } from '../src/lib/zip.js'
import { validateElementImportPackageBuffer } from '../src/services/elementImportExport.js'
import {
  computeAnswerCollectionImportFingerprint,
  computeElementImportFingerprint,
} from '../src/services/importExportFingerprints.js'
import {
  createAvailableImportExportRedis,
  createMediaExportElement,
  createSelectionValidationPackage,
  createValidationPackage,
  createZipWithInvalidEntryPath,
  expectImportValidationError,
  importExportTestUser,
  mockElementExportSnapshot,
  rewritePackageJson,
  useImportExportTestEnvironment,
  withEnv,
} from './elementImportExportTestSupport.js'

describe('Secure element import/export packages', () => {
  useImportExportTestEnvironment()
  it('validates ZIP package structure strictly', async () => {
    const validPackage = createValidationPackage()

    expect(() => validateElementImportPackageBuffer(validPackage)).not.toThrow()
    expect(() => parseZip(createZipWithInvalidEntryPath())).toThrow(
      /invalid zip entry path/i
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, {}, [{ path: 'notes.txt', data: 'nope' }])
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, { id: 42 } as any)
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, { type: 'NOT_A_TYPE' } as any)
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(Buffer.alloc(10 * 1024 * 1024 + 1)),
      ImportExportErrorCode.PACKAGE_TOO_LARGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, { pointsMultiplier: 5 })
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, { pointsMultiplier: 1.5 })
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage(
            {
              elements: [
                {
                  ref: 'selection-1',
                  file: 'elements/element-1.json',
                  answerCollectionRef: 'missing-collection',
                },
              ],
            },
            {
              ref: 'selection-1',
              type: ElementType.SELECTION,
              options: { hasSampleSolution: true, numberOfInputs: 1 },
              answerCollectionRef: 'missing-collection',
              answerCollectionItemRefs: ['missing-entry'],
            }
          )
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createSelectionValidationPackage({
            manifestAnswerCollectionRef: 'collection-1',
            elementAnswerCollectionRef: 'collection-2',
            answerCollectionItemRefs: ['collection-2-entry-1'],
          })
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createSelectionValidationPackage({
            manifestAnswerCollectionRef: 'collection-1',
            elementAnswerCollectionRef: 'collection-1',
            answerCollectionItemRefs: ['collection-2-entry-1'],
          })
        ),
      ImportExportErrorCode.INVALID_OPTIONS
    )
  })

  it('strips dormant selection solution refs before dependency and preview use', () => {
    for (const answerCollectionItemRefs of [
      ['collection-2-entry-1'],
      ['missing-entry', 'missing-entry'],
    ]) {
      const result = validateElementImportPackageBuffer(
        createSelectionValidationPackage({
          manifestAnswerCollectionRef: 'collection-1',
          elementAnswerCollectionRef: 'collection-1',
          answerCollectionItemRefs,
          hasSampleSolution: false,
        })
      )

      expect(
        result.normalizedPackage.elements[0]?.answerCollectionItemRefs
      ).toEqual([])
      expect(result.preview.elements[0]?.answerCollectionItemIds).toEqual([])
    }
  })

  it('does not misclassify unexpected parser failures as invalid packages', () => {
    const unexpectedFailure = new Error('unexpected parser adapter failure')

    expect(() =>
      validateElementImportPackageBuffer(createValidationPackage(), {
        parseArchive: () => {
          throw unexpectedFailure
        },
      })
    ).toThrow(unexpectedFailure)
  })

  it('rejects globally duplicated package-local refs', () => {
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({
            elements: [
              { ref: 'element-1', file: 'elements/element-1.json' },
              { ref: 'element-1', file: 'elements/element-2.json' },
            ],
          })
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )

    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({
            answerCollections: [
              {
                ref: 'collection-1',
                file: 'answer-collections/collection-1.json',
              },
              {
                ref: 'collection-1',
                file: 'answer-collections/collection-2.json',
              },
            ],
          })
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )

    const duplicateEntryRefPackage = rewritePackageJson(
      createSelectionValidationPackage({
        manifestAnswerCollectionRef: 'collection-1',
        elementAnswerCollectionRef: 'collection-1',
        answerCollectionItemRefs: ['collection-1-entry-1'],
      }),
      {
        'answer-collections/collection-2.json': (collection: any) => ({
          ...collection,
          entries: collection.entries.map((entry: any) => ({
            ...entry,
            ref: 'collection-1-entry-1',
          })),
        }),
      }
    )

    expectImportValidationError(
      () => validateElementImportPackageBuffer(duplicateEntryRefPackage),
      ImportExportErrorCode.INVALID_PACKAGE
    )

    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage(
            {
              elements: [
                { ref: 'shared-ref', file: 'elements/element-1.json' },
              ],
              answerCollections: [
                {
                  ref: 'shared-ref',
                  file: 'answer-collections/shared-ref.json',
                },
              ],
            },
            { ref: 'shared-ref' },
            [
              {
                path: 'answer-collections/shared-ref.json',
                data: JSON.stringify({
                  ref: 'shared-ref',
                  name: 'Shared ref collection',
                  description: '',
                  entries: [{ ref: 'shared-ref-entry', value: 'Alpha' }],
                }),
              },
            ]
          )
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('fingerprints answer collections from authored payload fields only', () => {
    const collection = {
      ref: 'collection-a',
      name: 'Cities',
      description: 'Capital city answers',
      version: 2,
      entries: [
        { ref: 'entry-1', value: 'Zurich' },
        { ref: 'entry-2', value: 'Bern' },
      ],
    } as any
    const fingerprint = computeAnswerCollectionImportFingerprint(collection)

    expect(
      computeAnswerCollectionImportFingerprint({
        ...collection,
        ref: 'collection-b',
        entries: [
          { ref: 'different-entry-2', value: 'Bern' },
          { ref: 'different-entry-1', value: 'Zurich' },
        ],
      })
    ).toBe(fingerprint)
    expect(
      computeAnswerCollectionImportFingerprint({
        ...collection,
        version: 3,
      })
    ).toBe(fingerprint)
    expect(
      computeAnswerCollectionImportFingerprint({
        ...collection,
        entries: [
          { ref: 'entry-1', value: 'Zurich' },
          { ref: 'entry-2', value: 'Basel' },
        ],
      })
    ).not.toBe(fingerprint)
    expect(
      computeAnswerCollectionImportFingerprint({
        name: collection.name,
        description: collection.description,
        entries: collection.entries,
      })
    ).toBe(
      computeAnswerCollectionImportFingerprint({
        ...collection,
        version: 1,
      })
    )
  })

  it('fingerprints element authored payloads while ignoring package wiring', () => {
    const mediaIdentity = `import-media:${createHash('sha256')
      .update('image')
      .digest('hex')}`
    const element = {
      name: 'Swiss capital',
      content: 'Choose the capital. ![map](klicker-package-media://media-1)',
      type: ElementType.SC,
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: 'Zurich', correct: false },
          { ix: 1, value: 'Bern', correct: true },
        ],
      },
      pointsMultiplier: 2,
      basePoints: true,
      explanation: 'Bern is correct. ![map](klicker-package-media://media-1)',
      status: ElementStatus.READY,
      mediaIdentityByUrl: new Map([
        ['klicker-package-media://media-1', mediaIdentity],
      ]),
    }
    const fingerprint = computeElementImportFingerprint(element)

    expect(
      computeElementImportFingerprint({
        ...element,
        content:
          'Choose the capital. ![map](klicker-package-media://renamed-media)',
        explanation:
          'Bern is correct. ![map](klicker-package-media://renamed-media)',
        mediaIdentityByUrl: new Map([
          ['klicker-package-media://renamed-media', mediaIdentity],
        ]),
      })
    ).toBe(fingerprint)
    expect(
      computeElementImportFingerprint({
        ...element,
        tags: ['Geography', 'Advanced'],
      } as any)
    ).toBe(fingerprint)
    expect(
      computeElementImportFingerprint({
        ...element,
        status: ElementStatus.REVIEW,
      })
    ).toBe(fingerprint)
    expect(
      computeElementImportFingerprint({
        ...element,
        options: {
          ...element.options,
          choices: [
            { ix: 0, value: 'Zurich', correct: false },
            { ix: 1, value: 'Bern', correct: false },
          ],
        },
      })
    ).not.toBe(fingerprint)
  })

  it('keeps collection metadata out of identity and plain entry links authored', () => {
    const first = computeAnswerCollectionImportFingerprint({
      name: 'Media collection',
      description: '![image](https://one.example/image.png)',
      version: 1,
      entries: [{ value: 'Source: https://one.example/reference' }],
    })
    const metadataOnlyChange = computeAnswerCollectionImportFingerprint({
      name: 'Renamed collection',
      description: '![image](https://two.example/other.png)',
      version: 99,
      entries: [{ value: 'Source: https://one.example/reference' }],
    })
    const changedEntryLink = computeAnswerCollectionImportFingerprint({
      entries: [{ value: 'Source: https://two.example/reference' }],
    })

    expect(metadataOnlyChange).toBe(first)
    expect(changedEntryLink).not.toBe(first)
  })

  it('fingerprints escaped Markdown media destinations by parsed identity', () => {
    const mediaIdentity = `import-media:${createHash('sha256')
      .update('escaped image')
      .digest('hex')}`
    const sourceHref = 'klicker-package-media://media-1'
    const renamedHref = 'klicker-package-media://renamed-media'
    const base = {
      name: 'Escaped media',
      type: ElementType.SC,
      options: {
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: 'A', correct: true },
          { ix: 1, value: 'B', correct: false },
        ],
      },
      pointsMultiplier: 1,
      basePoints: true,
      explanation: null,
      status: ElementStatus.READY,
    }

    expect(
      computeElementImportFingerprint({
        ...base,
        content: '![image](klicker\\-package\\-media://media\\-1 "Preview")',
        mediaIdentityByUrl: new Map([[sourceHref, mediaIdentity]]),
      })
    ).toBe(
      computeElementImportFingerprint({
        ...base,
        content: `![image](<${renamedHref}> "Preview")`,
        mediaIdentityByUrl: new Map([[renamedHref, mediaIdentity]]),
      })
    )
  })

  it('fingerprints linked answer collection content, not package refs', () => {
    const selectionElement = {
      name: 'Select the capital',
      content: 'Pick one',
      type: ElementType.SELECTION,
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        answerCollection: { id: -1, entries: [] },
        correctAnswers: [-1],
      },
      pointsMultiplier: 1,
      basePoints: true,
      explanation: null,
      status: ElementStatus.READY,
      answerCollection: {
        ref: 'collection-a',
        name: 'Cities',
        description: '',
        version: 1,
        entries: [
          { ref: 'entry-a', value: 'Bern' },
          { ref: 'entry-b', value: 'Zurich' },
        ],
      },
      selectedAnswerCollectionValues: ['Bern'],
    } as any
    const fingerprint = computeElementImportFingerprint(selectionElement)

    expect(
      computeElementImportFingerprint({
        ...selectionElement,
        options: {
          ...selectionElement.options,
          answerCollection: { id: -99, entries: [] },
          correctAnswers: [-99],
        },
        answerCollection: {
          ...selectionElement.answerCollection,
          ref: 'collection-b',
          entries: [
            { ref: 'different-entry-a', value: 'Bern' },
            { ref: 'different-entry-b', value: 'Zurich' },
          ],
        },
        selectedAnswerCollectionValues: ['Bern'],
      })
    ).toBe(fingerprint)
    expect(
      computeElementImportFingerprint({
        ...selectionElement,
        answerCollection: {
          ...selectionElement.answerCollection,
          entries: [
            { ref: 'entry-a', value: 'Basel' },
            { ref: 'entry-b', value: 'Zurich' },
          ],
        },
        selectedAnswerCollectionValues: ['Basel'],
      })
    ).not.toBe(fingerprint)
  })

  it('collects media warnings from content, explanations, and nested option strings', async () => {
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/11111111-1111-1111-1111-111111111111/imported/missing.png'
    const externalHref = 'https://example.com/external-media.png'

    await withEnv(
      {
        BLOB_STORAGE_ACCOUNT_NAME: 'testaccount',
      },
      async () => {
        const result = validateElementImportPackageBuffer(
          createValidationPackage(
            {},
            {
              content: `Content with ![external](${externalHref})`,
              explanation: `Explanation with ![first-party](${firstPartyHref})`,
              options: {
                displayMode: 'LIST',
                hasSampleSolution: false,
                hasAnswerFeedbacks: false,
                choices: [
                  {
                    ix: 0,
                    value: `Nested external ![media](${externalHref})`,
                  },
                  {
                    ix: 1,
                    value: `Nested first-party ![media](${firstPartyHref})`,
                  },
                ],
              },
            }
          )
        )

        expect(result.warnings).toEqual(
          expect.arrayContaining([
            'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED',
            'IMPORT_MEDIA_NOT_INCLUDED',
          ])
        )
        expect(JSON.stringify(result.preview)).not.toContain(externalHref)
        expect(JSON.stringify(result.preview)).not.toContain(firstPartyHref)
        expect(JSON.stringify(result.preview)).toContain(
          IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
        )
      }
    )
  })

  it('does not warn about first-party media that is included in the package', async () => {
    const packageMediaHref = 'klicker-package-media://media-1'
    const mediaData = Buffer.from('included media data')
    const sha256 = createHash('sha256').update(mediaData).digest('hex')

    await withEnv(
      {
        BLOB_STORAGE_ACCOUNT_NAME: 'testaccount',
      },
      async () => {
        const result = validateElementImportPackageBuffer(
          createValidationPackage(
            {
              media: [
                {
                  ref: 'media-1',
                  file: 'media/media-1.png',
                  filename: 'media-1.png',
                  contentType: 'image/png',
                  bytes: mediaData.length,
                  sha256,
                  sourceHref: packageMediaHref,
                },
              ],
            },
            {
              content: `Content with ![included](${packageMediaHref})`,
              options: {
                displayMode: 'LIST',
                hasSampleSolution: false,
                hasAnswerFeedbacks: false,
                choices: [
                  {
                    ix: 0,
                    value: `Nested packaged ![media](${packageMediaHref})`,
                  },
                  { ix: 1, value: 'Plain choice' },
                ],
              },
            },
            [{ path: 'media/media-1.png', data: mediaData }]
          )
        )

        expect(result.warnings).not.toContain('IMPORT_MEDIA_NOT_INCLUDED')
      }
    )
  })

  it('loads preview metadata once per unique URL with bounded concurrency', async () => {
    const urls = Array.from(
      { length: 6 },
      (_, index) =>
        `https://testaccount.blob.core.windows.net/source-owner/imported/media-${index + 1}.png`
    )
    const aliases = [`${urls[0]}?v=1`, `${urls[0]}?v=2`]
    let active = 0
    let maximumActive = 0
    const getKlickerMediaFileExportMetadata = vi.fn(async (href: string) => {
      active++
      maximumActive = Math.max(maximumActive, active)
      await Promise.resolve()
      active--
      const body = Buffer.from(`bytes:${href}`)
      return {
        bytes: body.length,
        contentType: 'image/png',
        filename: href.split('/').at(-1)!,
        sha256: createHash('sha256').update(body).digest('hex'),
      }
    })
    const getKlickerMediaFilesExportMetadata = vi.fn(
      async (hrefs: string[]) => {
        const entries = new Array<readonly [string, unknown]>(hrefs.length)
        let nextIndex = 0
        await Promise.all(
          Array.from({ length: Math.min(4, hrefs.length) }, async () => {
            while (nextIndex < hrefs.length) {
              const index = nextIndex++
              entries[index] = [
                hrefs[index]!,
                await getKlickerMediaFileExportMetadata(hrefs[index]!),
              ] as const
            }
          })
        )
        return new Map(entries)
      }
    )
    const downloadKlickerMediaFile = vi.fn(async (href: string) => ({
      buffer: Buffer.from(`bytes:${href}`),
      contentType: 'image/png',
      filename: href.split('/').at(-1)!,
      originalId: href,
    }))
    const element = {
      ...createMediaExportElement(urls[0]!),
      content: [...urls, ...aliases]
        .map((url) => `![media](${url})`)
        .join('\n'),
      explanation: `Duplicate ![media](${urls[0]})`,
    }

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile,
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata,
      getKlickerMediaFilesExportMetadata,
      parseKlickerMediaUrl: vi.fn((href: string) => {
        const parsed = new URL(href)
        return parsed.hostname === 'testaccount.blob.core.windows.net'
          ? {
              containerName: 'source-owner',
              blobName: parsed.pathname.split('/').at(-1)!,
            }
          : null
      }),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const {
        createElementExportPackage: createWithMockedMedia,
        getElementExportPackagePreview: getPreviewWithMockedMedia,
      } = await import('../src/services/elementImportExport.js')
      const ctx = {
        user: importExportTestUser('owner-id'),
        redisExec: createAvailableImportExportRedis(),
        prisma: {
          element: { findMany: vi.fn(async () => [element]) },
        },
      } as any

      await expect(
        getPreviewWithMockedMedia({ elementIds: [element.id] }, ctx)
      ).resolves.toMatchObject({ warnings: [], errors: [] })

      expect(getKlickerMediaFileExportMetadata).toHaveBeenCalledTimes(
        urls.length
      )
      expect(getKlickerMediaFilesExportMetadata).toHaveBeenCalledOnce()
      expect(
        new Set(
          getKlickerMediaFileExportMetadata.mock.calls.map(([href]) => href)
        )
      ).toEqual(new Set(urls))
      expect(maximumActive).toBe(4)
      await expect(
        createWithMockedMedia({ elementIds: [element.id] }, ctx)
      ).resolves.toMatchObject({ buffer: expect.any(Buffer) })
      expect(downloadKlickerMediaFile).toHaveBeenCalledTimes(urls.length)
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('rejects more than 100 canonical media targets before metadata or download I/O', async () => {
    const urls = Array.from(
      { length: 101 },
      (_, index) =>
        `https://testaccount.blob.core.windows.net/source-owner/imported/bounded-${index + 1}.png`
    )
    const element = {
      ...createMediaExportElement(urls[0]!),
      content: urls.map((url) => `![media](${url})`).join('\n'),
    }
    const getKlickerMediaFileExportMetadata = vi.fn()
    const downloadKlickerMediaFile = vi.fn()

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile,
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata,
      parseKlickerMediaUrl: vi.fn((href: string) => {
        const parsed = new URL(href)
        return {
          containerName: 'source-owner',
          blobName: parsed.pathname.split('/').at(-1)!,
        }
      }),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const {
        createElementExportPackage: createWithMockedMedia,
        getElementExportPackagePreview: previewWithMockedMedia,
      } = await import('../src/services/elementImportExport.js')
      const ctx = {
        user: importExportTestUser('owner-id'),
        redisExec: createAvailableImportExportRedis(),
        prisma: { element: { findMany: vi.fn(async () => [element]) } },
      } as any

      await expect(
        previewWithMockedMedia({ elementIds: [element.id] }, ctx)
      ).resolves.toMatchObject({
        errors: [ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE],
      })
      await expect(
        createWithMockedMedia({ elementIds: [element.id] }, ctx)
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE,
      })
      expect(getKlickerMediaFileExportMetadata).not.toHaveBeenCalled()
      expect(downloadKlickerMediaFile).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('keeps preview and final size decisions aligned for distinct media with identical bytes', async () => {
    const hrefs = [
      'https://testaccount.blob.core.windows.net/source-owner/imported/duplicate-a.png',
      'https://testaccount.blob.core.windows.net/source-owner/imported/duplicate-b.png',
    ]
    const sharedBytes = Buffer.alloc(5 * 1024 * 1024)
    const element = {
      ...createMediaExportElement(hrefs[0]!),
      content: hrefs.map((href) => `![media](${href})`).join('\n'),
    }
    const metadata = new Map(
      hrefs.map((href, index) => [
        href,
        {
          bytes: sharedBytes.length,
          contentType: 'image/png',
          filename: `duplicate-${index + 1}.png`,
          sha256: createHash('sha256').update(sharedBytes).digest('hex'),
        },
      ])
    )
    const downloadKlickerMediaFile = vi.fn(async (_href: string) => ({
      buffer: sharedBytes,
      contentType: 'image/png',
      filename: 'duplicate.png',
      originalId: randomUUID(),
    }))

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile,
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata: vi.fn(),
      getKlickerMediaFilesExportMetadata: vi.fn(async () => metadata),
      parseKlickerMediaUrl: vi.fn((href: string) => {
        const parsed = new URL(href)
        return {
          containerName: 'source-owner',
          blobName: parsed.pathname.split('/').at(-1)!,
        }
      }),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const {
        createElementExportPackage: createWithMockedMedia,
        getElementExportPackagePreview: previewWithMockedMedia,
      } = await import('../src/services/elementImportExport.js')
      const ctx = {
        user: importExportTestUser('owner-id'),
        redisExec: createAvailableImportExportRedis(),
        prisma: {},
      } as any

      await expect(
        previewWithMockedMedia({ elementIds: [element.id] }, ctx)
      ).resolves.toMatchObject({
        errors: [ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE],
      })
      await expect(
        createWithMockedMedia({ elementIds: [element.id] }, ctx)
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE,
      })
      expect(downloadKlickerMediaFile).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })
})
