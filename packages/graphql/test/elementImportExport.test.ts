import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ElementStatus,
  ElementType,
  PermissionLevel,
  PrismaClient,
  UserLoginScope,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { graphql } from 'graphql/index.js'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  assertImportExportPackageStorageConfig,
  assertImportExportTokenSecretConfig,
  cleanupImportExportPackages,
  readLocalImportExportPackageBlob,
  schema,
  writeLocalImportExportPackageBlob,
} from '../src/index.js'
import { createZip, parseZip } from '../src/lib/zip.js'
import {
  createElementExportPackage,
  getElementExportPackageLink,
  importElementPackage,
  importElementPackageBuffer,
  prepareElementImportPackageUpload,
  validateElementImportPackage,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'
import {
  computeAnswerCollectionImportFingerprint,
  computeElementImportFingerprint,
} from '../src/services/importExportFingerprints.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import { userFour, userThree, userTwo } from './userData.js'

describe('Secure element import/export packages', () => {
  it('validates ZIP package structure strictly', async () => {
    const validPackage = createValidationPackage()

    expect(() => validateElementImportPackageBuffer(validPackage)).not.toThrow()
    expect(() => parseZip(createZipWithInvalidEntryPath())).toThrow(
      /invalid zip entry path/i
    )
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, {}, [{ path: 'notes.txt', data: 'nope' }])
      )
    ).toThrow(/unexpected files/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { id: 42 } as any)
      )
    ).toThrow()
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { type: 'NOT_A_TYPE' } as any)
      )
    ).toThrow()
    expect(() =>
      validateElementImportPackageBuffer(Buffer.alloc(10 * 1024 * 1024 + 1))
    ).toThrow(/too large/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { pointsMultiplier: 5 })
      )
    ).toThrow()
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { pointsMultiplier: 1.5 })
      )
    ).toThrow()
    expect(() =>
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
            answerCollectionRef: 'missing-collection',
            answerCollectionItemRefs: ['missing-entry'],
          }
        )
      )
    ).toThrow(/unknown collection/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createSelectionValidationPackage({
          manifestAnswerCollectionRef: 'collection-1',
          elementAnswerCollectionRef: 'collection-2',
          answerCollectionItemRefs: ['collection-2-entry-1'],
        })
      )
    ).toThrow(/reference mismatch/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createSelectionValidationPackage({
          manifestAnswerCollectionRef: 'collection-1',
          elementAnswerCollectionRef: 'collection-1',
          answerCollectionItemRefs: ['collection-2-entry-1'],
        })
      )
    ).toThrow(/unknown entry/i)
  })

  it('rejects globally duplicated package-local refs', () => {
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({
          elements: [
            { ref: 'element-1', file: 'elements/element-1.json' },
            { ref: 'element-1', file: 'elements/element-2.json' },
          ],
        })
      )
    ).toThrow(/element references must be unique/i)

    expect(() =>
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
      )
    ).toThrow(/answer collection references must be unique/i)

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

    expect(() =>
      validateElementImportPackageBuffer(duplicateEntryRefPackage)
    ).toThrow(
      /globally unique|answer collection entry references must be unique/i
    )

    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage(
          {
            elements: [{ ref: 'shared-ref', file: 'elements/element-1.json' }],
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
      )
    ).toThrow(/package references must be globally unique/i)
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
    ).not.toBe(fingerprint)
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
    const mediaIdentity = 'klicker-package-media-sha256:'.concat(
      createHash('sha256').update('image').digest('hex')
    )
    const element = {
      name: 'Swiss capital',
      content: 'Choose the capital. klicker-package-media://media-1',
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
      explanation: 'Bern is correct. klicker-package-media://media-1',
      status: ElementStatus.READY,
      tags: ['Geography', 'Basics'],
      mediaIdentityByUrl: new Map([
        ['klicker-package-media://media-1', mediaIdentity],
      ]),
    }
    const fingerprint = computeElementImportFingerprint(element)

    expect(
      computeElementImportFingerprint({
        ...element,
        content: 'Choose the capital. klicker-package-media://renamed-media',
        explanation: 'Bern is correct. klicker-package-media://renamed-media',
        tags: ['Basics', 'Geography', 'Geography'],
        mediaIdentityByUrl: new Map([
          ['klicker-package-media://renamed-media', mediaIdentity],
        ]),
      })
    ).toBe(fingerprint)
    expect(
      computeElementImportFingerprint({
        ...element,
        tags: ['Geography', 'Advanced'],
      })
    ).not.toBe(fingerprint)
    expect(
      computeElementImportFingerprint({
        ...element,
        status: ElementStatus.REVIEW,
      })
    ).not.toBe(fingerprint)
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
      tags: [],
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
              content: `Content with ${externalHref}`,
              explanation: `Explanation with ${firstPartyHref}`,
              options: {
                displayMode: 'LIST',
                hasSampleSolution: false,
                hasAnswerFeedbacks: false,
                choices: [
                  { ix: 0, value: `Nested external ${externalHref}` },
                  { ix: 1, value: `Nested first-party ${firstPartyHref}` },
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
              content: `Content with ${packageMediaHref}`,
              options: {
                displayMode: 'LIST',
                hasSampleSolution: false,
                hasAnswerFeedbacks: false,
                choices: [
                  { ix: 0, value: `Nested packaged ${packageMediaHref}` },
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

  it('exports anonymized refs and package-local media references', async () => {
    const elementId = 987_654_321
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/source.png'
    const mediaData = Buffer.from('exported media bytes')

    vi.resetModules()
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(async () => ({
        buffer: mediaData,
        contentType: 'image/png',
        filename: 'original-source.png',
        originalId: 'source-media-id',
      })),
      finalizeStagedImportedMediaFile: vi.fn(),
      isKlickerMediaFileExportable: vi.fn(),
      parseKlickerMediaUrl: vi.fn((href: string) =>
        href === firstPartyHref
          ? {
              containerName: 'source-owner',
              blobName: 'imported/source.png',
            }
          : null
      ),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const { createElementExportPackage: createWithMockedMedia } =
        await import('../src/services/elementImportExport.js')
      const exported = await createWithMockedMedia(
        { elementIds: [elementId] },
        {
          user: { sub: 'owner-id' },
          prisma: {
            element: {
              findMany: vi.fn(async () => [
                {
                  id: elementId,
                  name: 'Exported element',
                  content: `Question with ${firstPartyHref}`,
                  options: {
                    displayMode: 'LIST',
                    hasSampleSolution: false,
                    hasAnswerFeedbacks: false,
                    choices: [
                      { ix: 0, value: `Nested ${firstPartyHref}` },
                      { ix: 1, value: 'Plain choice' },
                    ],
                  },
                  type: ElementType.SC,
                  pointsMultiplier: 1,
                  explanation: `Explanation with ${firstPartyHref}`,
                  version: 42,
                  status: ElementStatus.READY,
                  answerCollectionId: null,
                  answerCollectionItems: [],
                  tags: [],
                  basePoints: true,
                },
              ]),
            },
          },
        } as any
      )

      const entries = parseZip(exported.buffer)
      const packageText = entries
        .map((entry) =>
          entry.path.endsWith('.json') ? entry.data.toString('utf8') : ''
        )
        .join('\n')
      const manifest = JSON.parse(
        entries
          .find((entry) => entry.path === 'manifest.json')!
          .data.toString('utf8')
      )
      const element = JSON.parse(
        entries
          .find((entry) => entry.path === 'elements/element-1.json')!
          .data.toString('utf8')
      )

      expect(manifest.elements).toEqual([
        { ref: 'element-1', file: 'elements/element-1.json' },
      ])
      expect(manifest.media).toMatchObject([
        {
          ref: 'media-1',
          file: 'media/media-1.png',
          filename: 'media-1.png',
          sourceHref: 'klicker-package-media://media-1',
        },
      ])
      expect(element.content).toContain('klicker-package-media://media-1')
      expect(element.explanation).toContain('klicker-package-media://media-1')
      expect(element.options.choices[0].value).toContain(
        'klicker-package-media://media-1'
      )
      expect(packageText).not.toContain(firstPartyHref)
      expect(packageText).not.toContain(String(elementId))
      expect(packageText).not.toContain('source-media-id')
      expect(packageText).not.toContain('"source"')
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.resetModules()
    }
  })

  it('surfaces element-file package tags during validation preview', () => {
    const result = validateElementImportPackageBuffer(
      createValidationPackage({}, { tags: ['Hello 123', 'Week 1'] })
    )

    expect(result.preview.elements[0]?.tags).toEqual(['Hello 123', 'Week 1'])
    expect(result.warnings).toContain('IMPORT_TAGS_OMITTED')
  })

  it('rejects macOS ZIP metadata and directory entries', () => {
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { tags: ['Hello 123'] }, [
          { path: 'elements/', data: '' },
        ])
      )
    ).toThrow(/unexpected files/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { tags: ['Hello 123'] }, [
          { path: '.DS_Store', data: 'metadata' },
        ])
      )
    ).toThrow(/unexpected files/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { tags: ['Hello 123'] }, [
          { path: 'elements/.DS_Store', data: 'metadata' },
        ])
      )
    ).toThrow(/unexpected files/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { tags: ['Hello 123'] }, [
          { path: '__MACOSX/._manifest.json', data: 'metadata' },
        ])
      )
    ).toThrow(/unexpected files/i)
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { tags: ['Hello 123'] }, [
          { path: '__MACOSX/elements/._element-1.json', data: 'metadata' },
        ])
      )
    ).toThrow(/unexpected files/i)
  })

  it('rejects packages wrapped in a single enclosing folder', async () => {
    const wrappedPackage = createZip([
      {
        path: 'klicker-elements-edited/manifest.json',
        data: JSON.stringify({
          type: 'klicker-element-package',
          version: 3,
          createdAt: new Date().toISOString(),
          elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
          answerCollections: [],
          media: [],
        }),
      },
      {
        path: 'klicker-elements-edited/elements/element-1.json',
        data: JSON.stringify({
          ref: 'element-1',
          name: 'Nested package element',
          content: 'Imported content',
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
          status: ElementStatus.READY,
          tags: ['Hello 123'],
        }),
      },
    ])
    const blobName = `imports/importer/${randomUUID()}-wrapped-package.zip`
    const ctx = {
      user: { sub: 'importer' },
      redisExec: {
        eval: vi.fn(async () => [1, 1]),
      },
    }

    expect(() => validateElementImportPackageBuffer(wrappedPackage)).toThrow(
      /manifest must be at the ZIP root/i
    )

    await withEnv(
      {
        IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
        NODE_ENV: 'test',
      },
      async () => {
        await writeLocalImportExportPackageBlob(blobName, wrappedPackage)

        await expect(
          validateElementImportPackage({ blobName }, ctx as any)
        ).resolves.toMatchObject({
          importToken: null,
          errors: ['IMPORT_MANIFEST_NOT_AT_ROOT'],
        })
      }
    )
  })

  it('rejects packages containing all common macOS ZIP metadata entries', () => {
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { tags: ['Hello 123'] }, [
          { path: 'elements/', data: '' },
          { path: '.DS_Store', data: 'metadata' },
          { path: 'elements/.DS_Store', data: 'metadata' },
          { path: '__MACOSX/._manifest.json', data: 'metadata' },
          { path: '__MACOSX/elements/._element-1.json', data: 'metadata' },
        ])
      )
    ).toThrow(/unexpected files|too many files/i)
  })

  it('rejects manifest-level element tags with a stable validation error code', async () => {
    const buffer = createValidationPackage({
      elements: [
        {
          ref: 'element-1',
          file: 'elements/element-1.json',
          tags: ['Hello 123'],
        },
      ],
    })
    const blobName = `imports/importer/${randomUUID()}-package.zip`
    const ctx = {
      user: { sub: 'importer' },
      redisExec: {
        eval: vi.fn(async () => [1, 1]),
      },
    }

    expect(() => validateElementImportPackageBuffer(buffer)).toThrow(
      /unrecognized key/i
    )

    await withEnv(
      {
        IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
        NODE_ENV: 'test',
      },
      async () => {
        await writeLocalImportExportPackageBlob(blobName, buffer)

        await expect(
          validateElementImportPackage({ blobName }, ctx as any)
        ).resolves.toMatchObject({
          importToken: null,
          errors: ['IMPORT_ELEMENT_TAGS_IN_MANIFEST'],
        })
      }
    )
  })

  it('rejects packages whose manifest is nested too deeply', async () => {
    const nestedPackage = createZip([
      {
        path: 'outer/klicker-elements-edited/manifest.json',
        data: JSON.stringify({
          type: 'klicker-element-package',
          version: 3,
          createdAt: new Date().toISOString(),
          elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
          answerCollections: [],
          media: [],
        }),
      },
      {
        path: 'outer/klicker-elements-edited/elements/element-1.json',
        data: JSON.stringify({
          ref: 'element-1',
          name: 'Nested package element',
          content: 'Imported content',
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
          status: ElementStatus.READY,
          tags: ['Hello 123'],
        }),
      },
    ])
    const blobName = `imports/importer/${randomUUID()}-nested-package.zip`
    const ctx = {
      user: { sub: 'importer' },
      redisExec: {
        eval: vi.fn(async () => [1, 1]),
      },
    }

    await withEnv(
      {
        IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
        NODE_ENV: 'test',
      },
      async () => {
        await writeLocalImportExportPackageBlob(blobName, nestedPackage)

        await expect(
          validateElementImportPackage({ blobName }, ctx as any)
        ).resolves.toMatchObject({
          importToken: null,
          errors: ['IMPORT_MANIFEST_NOT_AT_ROOT'],
        })
      }
    )
  })

  it('rejects ZIP entries with mismatched checksums', () => {
    const validPackage = createValidationPackage()
    const corrupted = Buffer.from(validPackage)
    const contentOffset = corrupted.indexOf(Buffer.from('Imported content'))

    expect(contentOffset).toBeGreaterThan(-1)
    corrupted[contentOffset] = corrupted[contentOffset]! ^ 0xff

    expect(() => parseZip(corrupted)).toThrow(/checksum/i)
  })

  it('accepts ZIP data-descriptor flags used by platform archive tools', () => {
    expect(() =>
      validateElementImportPackageBuffer(
        createZipWithDataDescriptorFlags(createValidationPackage())
      )
    ).not.toThrow()
  })

  it('rejects malformed ZIP buffers without unsafe parsing behavior', () => {
    const validPackage = createValidationPackage()
    const corruptedCentralOffset = Buffer.from(validPackage)
    corruptedCentralOffset.writeUInt32LE(
      corruptedCentralOffset.length + 1024,
      corruptedCentralOffset.length - 22 + 16
    )

    const malformedBuffers = [
      Buffer.alloc(0),
      Buffer.from('not a zip archive'),
      validPackage.subarray(0, 10),
      corruptedCentralOffset,
      createZipWithCentralLocalPathMismatch(),
      createZipWithHugeDeclaredSize(),
      ...Array.from({ length: 16 }, (_, ix) =>
        createDeterministicBuffer(ix + 1, 8 + ix * 17)
      ),
    ]

    for (const buffer of malformedBuffers) {
      expect(() =>
        parseZip(buffer, { maxEntries: 5, maxUncompressedBytes: 1024 })
      ).toThrow()
    }
  })

  it('rejects local package storage in production', async () => {
    await withEnv(
      {
        BLOB_STORAGE_ACCESS_KEY: 'test-key',
        BLOB_STORAGE_ACCOUNT_NAME: 'testaccount',
        IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
        IMPORT_EXPORT_TOKEN_SECRET: 'test-secret',
        NODE_ENV: 'production',
      },
      async () => {
        expect(() => assertImportExportPackageStorageConfig()).toThrow(
          /outside development and test/i
        )
      }
    )
  })

  it('rejects local package storage in production-like runtimes', async () => {
    await withEnv(
      {
        BLOB_STORAGE_ACCESS_KEY: 'test-key',
        BLOB_STORAGE_ACCOUNT_NAME: 'testaccount',
        IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
        IMPORT_EXPORT_TOKEN_SECRET: 'test-secret',
        NODE_ENV: 'stg',
      },
      async () => {
        expect(() => assertImportExportPackageStorageConfig()).toThrow(
          /outside development and test/i
        )
      }
    )
  })

  it('requires Azure package storage credentials in production', async () => {
    await withEnv(
      {
        BLOB_STORAGE_ACCESS_KEY: undefined,
        BLOB_STORAGE_ACCOUNT_NAME: undefined,
        IMPORT_EXPORT_PACKAGE_STORAGE: 'azure',
        IMPORT_EXPORT_TOKEN_SECRET: 'test-secret',
        NODE_ENV: 'production',
      },
      async () => {
        expect(() => assertImportExportPackageStorageConfig()).toThrow(
          /blob storage credentials/i
        )
      }
    )
  })

  it('requires a dedicated import/export token secret in production', async () => {
    await withEnv(
      {
        APP_SECRET: 'fallback-secret',
        BLOB_STORAGE_ACCESS_KEY: 'fallback-key',
        IMPORT_EXPORT_TOKEN_SECRET: undefined,
        NEXTAUTH_SECRET: 'fallback-nextauth',
        NODE_ENV: 'production',
      },
      async () => {
        expect(() => assertImportExportTokenSecretConfig()).toThrow(
          /IMPORT_EXPORT_TOKEN_SECRET/
        )
      }
    )
  })

  it('requires a dedicated import/export token secret in production-like runtimes', async () => {
    await withEnv(
      {
        APP_SECRET: 'fallback-secret',
        BLOB_STORAGE_ACCESS_KEY: 'fallback-key',
        IMPORT_EXPORT_TOKEN_SECRET: undefined,
        NEXTAUTH_SECRET: 'fallback-nextauth',
        NODE_ENV: 'stg',
      },
      async () => {
        expect(() => assertImportExportTokenSecretConfig()).toThrow(
          /IMPORT_EXPORT_TOKEN_SECRET/
        )
      }
    )
  })

  it('separates rate-limit exhaustion from Redis outages', async () => {
    await withEnv(
      {
        IMPORT_EXPORT_PACKAGE_UPLOAD_RATE_LIMIT: '1',
        IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS: '60',
      },
      async () => {
        const unavailableCtx = {
          user: { sub: 'rate-limit-user' },
          redisExec: {
            eval: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
          },
        }
        await expect(
          prepareElementImportPackageUpload(
            { filename: 'package.zip' },
            unavailableCtx as any
          )
        ).rejects.toThrow(/temporarily unavailable/i)

        const exceededCtx = {
          user: { sub: 'rate-limit-user' },
          redisExec: {
            eval: vi.fn().mockResolvedValue([0, 1]),
          },
        }
        await expect(
          prepareElementImportPackageUpload(
            { filename: 'package.zip' },
            exceededCtx as any
          )
        ).rejects.toThrow(/try again later/i)
      }
    )
  })

  it('stages packaged media before opening the import transaction', async () => {
    const calls: string[] = []
    let manipulatedArgs: any
    const sourceHref = 'klicker-package-media://media-1'
    const importedHref =
      'https://testaccount.blob.core.windows.net/importer/imported/staged.png'
    const mediaData = Buffer.from('media staged before transaction')
    const sha256 = createHash('sha256').update(mediaData).digest('hex')

    vi.resetModules()
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(async () => {
        calls.push('cleanup')
      }),
      downloadKlickerMediaFile: vi.fn(),
      finalizeStagedImportedMediaFile: vi.fn(async () => {
        calls.push('finalize')
        return { href: importedHref, unusedStagedHref: null }
      }),
      isKlickerMediaFileExportable: vi.fn(),
      parseKlickerMediaUrl: vi.fn(() => ({
        containerName: 'source-owner',
        blobName: 'imported/source.png',
      })),
      stageImportedMediaFile: vi.fn(async () => {
        calls.push('stage')
        return {
          id: '11111111-1111-1111-1111-111111111111',
          href: importedHref,
          ownerId: 'importer',
          contentType: 'image/png',
          filename: 'source.png',
          originalId: `import-media:${sha256}`,
          createdBlob: true,
        }
      }),
    }))
    vi.doMock('../src/services/elements.js', () => ({
      manipulateElement: vi.fn(async (args) => {
        calls.push('manipulate')
        manipulatedArgs = args
        return { id: 123 }
      }),
    }))

    try {
      const { importElementPackageBuffer: importWithMockedMedia } =
        await import('../src/services/elementImportExport.js')
      const buffer = createValidationPackage(
        {
          media: [
            {
              ref: 'media-1',
              file: 'media/media-1.png',
              filename: 'source.png',
              contentType: 'image/png',
              bytes: mediaData.length,
              sha256,
              sourceHref,
            },
          ],
        },
        {
          content: `Imported content ${sourceHref}`,
          tags: ['Calculus', 'Week 1'],
        },
        [{ path: 'media/media-1.png', data: mediaData }]
      )
      const txPrisma = {
        element: {
          update: vi.fn(async () => ({})),
        },
      }
      const ctx = {
        user: { sub: 'importer' },
        emitter: { emit: vi.fn() },
        prisma: {
          element: {
            findMany: vi.fn(async () => []),
          },
          $transaction: vi.fn(async (fn) => {
            calls.push('transaction-start')
            return await fn(txPrisma)
          }),
        },
      }

      await expect(
        importWithMockedMedia(
          {
            buffer,
            selectedElementRefs: ['element-1'],
          },
          ctx as any
        )
      ).resolves.toEqual({
        importedElements: 1,
        importedAnswerCollections: 0,
        skippedElements: 0,
      })
      expect(calls).toEqual([
        'stage',
        'transaction-start',
        'finalize',
        'manipulate',
      ])
      expect(manipulatedArgs.tags).toEqual([])
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elements.js')
      vi.resetModules()
    }
  })

  it('rejects source metadata in v3 packages', () => {
    expect(() =>
      validateElementImportPackageBuffer(
        createValidationPackage({}, { source: { id: 'source-element-1' } })
      )
    ).toThrow(/source/i)
  })

  it('imports selected elements without duplicate skip behavior', async () => {
    const calls: string[] = []

    vi.resetModules()
    vi.doMock('../src/services/elements.js', () => ({
      manipulateElement: vi.fn(async () => {
        calls.push('manipulate')
        return { id: 123 }
      }),
    }))

    try {
      const { importElementPackageBuffer: importWithMockedElements } =
        await import('../src/services/elementImportExport.js')
      const txPrisma = {
        element: {
          update: vi.fn(async () => ({})),
        },
      }
      const ctx = {
        user: { sub: 'importer' },
        emitter: { emit: vi.fn() },
        prisma: {
          $transaction: vi.fn(async (fn) => {
            calls.push('transaction-start')
            return await fn(txPrisma)
          }),
        },
      }

      await expect(
        importWithMockedElements(
          {
            buffer: createValidationPackage(),
            selectedElementRefs: ['element-1'],
          },
          ctx as any
        )
      ).resolves.toEqual({
        importedElements: 1,
        importedAnswerCollections: 0,
        skippedElements: 0,
      })
      expect(calls).toEqual(['transaction-start', 'manipulate'])
      expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock('../src/services/elements.js')
      vi.resetModules()
    }
  })

  describe('database-backed package operations', () => {
    let prisma: PrismaClient
    let hatchet: Hatchet
    let emitter: EventEmitter
    let userOneCtx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
    let userTwoCtx: Awaited<ReturnType<typeof testInitialization>>['userTwoCtx']
    let userThreeCtx: Awaited<
      ReturnType<typeof testInitialization>
    >['userThreeCtx']
    let userFourCtx: Awaited<
      ReturnType<typeof testInitialization>
    >['userFourCtx']

    beforeAll(async () => {
      const {
        prisma: newPrisma,
        hatchet: newHatchet,
        emitter: newEmitter,
      } = await initializePrisma()
      prisma = newPrisma
      hatchet = newHatchet
      emitter = newEmitter
    })

    afterAll(async () => {
      await testCleanup(prisma)
      await prisma.$disconnect()
    })

    beforeEach(async () => {
      const initialized = await testInitialization(prisma, hatchet, emitter)
      userOneCtx = initialized.userOneCtx
      userTwoCtx = initialized.userTwoCtx
      userThreeCtx = initialized.userThreeCtx
      userFourCtx = initialized.userFourCtx
    })

    afterEach(async () => await testCleanup(prisma))

    it('requires WRITE+ permissions for portable element exports', async () => {
      const { singleChoice } = await seedPackageFixture(userOneCtx)

      await prisma.permission.createMany({
        data: [
          {
            userId: userTwo.id,
            elementId: singleChoice.id,
            permissionLevel: PermissionLevel.READ,
          },
          {
            userId: userThree.id,
            elementId: singleChoice.id,
            permissionLevel: PermissionLevel.WRITE,
          },
          {
            userId: userFour.id,
            elementId: singleChoice.id,
            permissionLevel: PermissionLevel.ADMIN,
          },
        ],
      })
      await recomputeDerivedPermissions({ elementId: singleChoice.id }, prisma)

      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userOneCtx
        )
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userTwoCtx
        )
      ).rejects.toThrow(/could not be exported/i)
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userThreeCtx
        )
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
      await expect(
        createElementExportPackage(
          { elementIds: [singleChoice.id] },
          userFourCtx
        )
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
    })

    it('blocks exports when linked answer collections are not WRITE+', async () => {
      const { selection, answerCollection } =
        await seedPackageFixture(userOneCtx)

      await prisma.permission.createMany({
        data: [
          {
            userId: userTwo.id,
            elementId: selection.id,
            permissionLevel: PermissionLevel.WRITE,
          },
          {
            userId: userTwo.id,
            answerCollectionId: answerCollection.id,
            permissionLevel: PermissionLevel.READ,
          },
        ],
      })
      await recomputeDerivedPermissions({ elementId: selection.id }, prisma)
      await recomputeDerivedPermissions(
        { answerCollectionId: answerCollection.id },
        prisma
      )

      await expect(
        createElementExportPackage({ elementIds: [selection.id] }, userTwoCtx)
      ).rejects.toThrow(/answer collections could not be exported/i)
    })

    it('remaps answer collection entries when importing selection and case-study elements', async () => {
      const { answerCollection, selection, caseStudy, entries } =
        await seedPackageFixture(userOneCtx)
      const mediaFilesBefore = await prisma.mediaFile.count()

      const exported = await createElementExportPackage(
        { elementIds: [selection.id, caseStudy.id] },
        userOneCtx
      )

      expect(exported.filename).toMatch(/\.zip$/)
      expect(await prisma.mediaFile.count()).toBe(mediaFilesBefore)

      const preview = validateElementImportPackageBuffer(exported.buffer)
      expect(preview.preview.elements).toHaveLength(2)
      expect(preview.preview.answerCollections).toHaveLength(1)

      const packageHash = createHash('sha256')
        .update(exported.buffer)
        .digest('hex')
      const exportedEntries = parseZip(exported.buffer)
      const exportedPaths = exportedEntries.map((entry) => entry.path)
      expect(exportedPaths).toEqual(
        expect.arrayContaining([
          'manifest.json',
          'elements/element-1.json',
          'elements/element-2.json',
          'answer-collections/answer-collection-1.json',
        ])
      )
      expect(exportedPaths).not.toContain(
        `elements/element-${selection.id}.json`
      )
      expect(exportedPaths).not.toContain(
        `elements/element-${caseStudy.id}.json`
      )
      const exportedManifest = JSON.parse(
        exportedEntries
          .find((entry) => entry.path === 'manifest.json')!
          .data.toString('utf8')
      )
      expect(exportedManifest.elements).toEqual([
        {
          ref: 'element-1',
          file: 'elements/element-1.json',
          answerCollectionRef: 'answer-collection-1',
        },
        {
          ref: 'element-2',
          file: 'elements/element-2.json',
          answerCollectionRef: 'answer-collection-1',
        },
      ])
      expect(exportedManifest.answerCollections).toEqual([
        {
          ref: 'answer-collection-1',
          file: 'answer-collections/answer-collection-1.json',
        },
      ])
      const exportedCollection = JSON.parse(
        exportedEntries
          .find(
            (entry) =>
              entry.path === 'answer-collections/answer-collection-1.json'
          )!
          .data.toString('utf8')
      )
      expect(exportedCollection.version).toBe(answerCollection.version)

      const result = await importElementPackageBuffer(
        {
          buffer: exported.buffer,
          selectedElementRefs: ['element-1', 'element-2'],
        },
        userTwoCtx
      )

      expect(result).toEqual({
        importedElements: 2,
        importedAnswerCollections: 1,
        skippedElements: 0,
      })

      const importedCollection = await prisma.answerCollection.findFirstOrThrow(
        {
          where: {
            ownerId: userTwo.id,
            name: answerCollection.name,
          },
          include: { entries: true },
        }
      )
      expect(importedCollection.id).not.toBe(answerCollection.id)
      expect(importedCollection.originalId).toBeNull()
      expect(importedCollection.version).toBe(answerCollection.version)
      expect(importedCollection.importFingerprint).toEqual(expect.any(String))

      const entryIdsByValue = new Map(
        importedCollection.entries.map((entry) => [entry.value, entry.id])
      )
      const importedSelection = await prisma.element.findFirstOrThrow({
        where: { ownerId: userTwo.id, name: selection.name },
        include: { answerCollectionItems: true },
      })
      expect(importedSelection.answerCollectionId).toBe(importedCollection.id)
      expect(importedSelection.status).toBe(ElementStatus.REVIEW)
      expect(importedSelection.originalId).toBe(
        `import-package:${packageHash.slice(0, 16)}:element-1`
      )
      expect(importedSelection.importFingerprint).toEqual(expect.any(String))
      expect(
        importedSelection.answerCollectionItems.map((entry) => entry.id)
      ).toEqual([entryIdsByValue.get(entries[0]!.value)])
      expect(importedSelection.answerCollectionItems[0]!.id).not.toBe(
        entries[0]!.id
      )

      const importedCaseStudy = await prisma.element.findFirstOrThrow({
        where: { ownerId: userTwo.id, name: caseStudy.name },
        include: { answerCollectionItems: true },
      })
      expect(importedCaseStudy.answerCollectionId).toBe(importedCollection.id)
      expect(importedCaseStudy.status).toBe(ElementStatus.REVIEW)
      expect(importedCaseStudy.originalId).toBe(
        `import-package:${packageHash.slice(0, 16)}:element-2`
      )
      expect(importedCaseStudy.importFingerprint).toEqual(expect.any(String))
      expect(
        importedCaseStudy.answerCollectionItems.map((entry) => entry.id).sort()
      ).toEqual(
        [entries[0]!.value, entries[1]!.value]
          .map((value) => entryIdsByValue.get(value))
          .sort()
      )

      const importedCaseOptions = importedCaseStudy.options as any
      const importedSolutionIds = importedCaseOptions.cases.flatMap(
        (caseItem) => caseItem.solutions.map((solution) => solution.itemId)
      )
      expect(importedSolutionIds).toEqual(
        expect.arrayContaining([
          entryIdsByValue.get(entries[0]!.value),
          entryIdsByValue.get(entries[1]!.value),
        ])
      )
      expect(importedSolutionIds).not.toEqual(
        expect.arrayContaining([entries[0]!.id, entries[1]!.id])
      )
    })

    it('shows advisory duplicate warnings without blocking duplicate imports', async () => {
      const { answerCollection, selection } =
        await seedPackageFixture(userOneCtx)
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )
      const blobName = `imports/${userOneCtx.user.sub}/${randomUUID()}-package.zip`

      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          await writeLocalImportExportPackageBlob(blobName, exported.buffer)
          await clearPackageRateLimitKeys(userOneCtx)

          const validation = await validateElementImportPackage(
            { blobName },
            userOneCtx
          )

          expect(validation.errors).toEqual([])
          expect(validation.elements).toHaveLength(1)
          expect(validation.elements[0]!.alreadyImported).toBe(true)
          expect(validation.elements[0]!.existingElementId).toBe(selection.id)
          expect(validation.answerCollections).toHaveLength(1)
          expect(validation.answerCollections[0]!.alreadyImported).toBe(true)
          expect(
            validation.answerCollections[0]!.existingAnswerCollectionId
          ).toBe(answerCollection.id)

          await expect(
            importElementPackageBuffer(
              {
                buffer: exported.buffer,
                selectedElementRefs: ['element-1'],
              },
              userOneCtx
            )
          ).resolves.toEqual({
            importedElements: 1,
            importedAnswerCollections: 1,
            skippedElements: 0,
          })

          await expect(
            prisma.element.count({
              where: { ownerId: userOneCtx.user.sub, name: selection.name },
            })
          ).resolves.toBe(2)
          await expect(
            prisma.answerCollection.count({
              where: {
                ownerId: userOneCtx.user.sub,
                name: answerCollection.name,
              },
            })
          ).resolves.toBe(2)
        }
      )
    })

    it('rejects packages containing source ids', async () => {
      const { selection } = await seedPackageFixture(userOneCtx)
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )
      const spoofedPackage = rewritePackageJson(exported.buffer, {
        'manifest.json': (manifest: any) => ({
          ...manifest,
          elements: manifest.elements.map((element: any) => ({
            ...element,
            source: { id: 999_999, version: 999 },
          })),
          answerCollections: manifest.answerCollections.map(
            (collection: any) => ({
              ...collection,
              source: { id: 999_999, version: 999 },
            })
          ),
        }),
        'elements/element-1.json': (element: any) => ({
          ...element,
          source: { id: 999_999, version: 999 },
        }),
        'answer-collections/answer-collection-1.json': (collection: any) => ({
          ...collection,
          source: { id: 999_999, version: 999 },
          entries: collection.entries.map((entry: any) => ({
            ...entry,
            source: { id: 999_999 },
          })),
        }),
      })

      expect(() => validateElementImportPackageBuffer(spoofedPackage)).toThrow(
        /source/i
      )
    })

    it('rejects selected element refs that are not present in the package', async () => {
      const { selection } = await seedPackageFixture(userOneCtx)
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )

      await expect(
        importElementPackageBuffer(
          {
            buffer: exported.buffer,
            selectedElementRefs: ['element-1', 'element-999999'],
          },
          userTwoCtx
        )
      ).rejects.toThrow(/could not be found/i)
    })

    it('requires full-access scope for export package GraphQL queries', async () => {
      const { singleChoice } = await seedPackageFixture(userOneCtx)
      const restrictedContexts = [
        {
          ...userOneCtx,
          user: { ...userOneCtx.user, scope: UserLoginScope.READ_ONLY },
        },
        {
          ...userOneCtx,
          user: { ...userOneCtx.user, scope: UserLoginScope.SESSION_EXEC },
        },
      ]
      const queries = [
        {
          field: 'getElementExportPackageLink',
          selection: 'filename',
        },
        {
          field: 'getElementExportPackagePreview',
          selection: 'errors',
        },
      ]

      const ownerPreview = await executeExportQuery({
        field: 'getElementExportPackagePreview',
        selection: 'errors',
        elementIds: [singleChoice.id],
        ctx: userOneCtx,
      })
      expect(ownerPreview.errors).toBeUndefined()

      for (const ctx of restrictedContexts) {
        for (const query of queries) {
          const result = await executeExportQuery({
            ...query,
            elementIds: [singleChoice.id],
            ctx,
          })
          expect(result.errors?.[0]?.message).toMatch(/unauthorized/i)
        }
      }
    })

    it('rate limits package-heavy operations per user', async () => {
      const { singleChoice, selection } = await seedPackageFixture(userOneCtx)
      const exported = await createElementExportPackage(
        { elementIds: [selection.id] },
        userOneCtx
      )

      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_EXPORT_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_UPLOAD_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_VALIDATE_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_IMPORT_RATE_LIMIT: '1',
          IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS: '60',
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          await clearPackageRateLimitKeys(userOneCtx)
          await expect(
            getElementExportPackageLink(
              { elementIds: [singleChoice.id] },
              userOneCtx
            )
          ).resolves.toMatchObject({
            filename: expect.stringMatching(/\.zip$/),
          })
          await expect(
            getElementExportPackageLink(
              { elementIds: [singleChoice.id] },
              userOneCtx
            )
          ).rejects.toThrow(/try again later/i)

          await clearPackageRateLimitKeys(userOneCtx)
          await expect(
            prepareElementImportPackageUpload(
              { filename: 'package.zip' },
              userOneCtx
            )
          ).resolves.toMatchObject({ blobName: expect.any(String) })
          await expect(
            prepareElementImportPackageUpload(
              { filename: 'package.zip' },
              userOneCtx
            )
          ).rejects.toThrow(/try again later/i)

          const blobName = `imports/${userTwoCtx.user.sub}/${randomUUID()}-package.zip`
          await writeLocalImportExportPackageBlob(blobName, exported.buffer)

          await clearPackageRateLimitKeys(userTwoCtx)
          await expect(
            validateElementImportPackage({ blobName }, userTwoCtx)
          ).resolves.toMatchObject({ importToken: expect.any(String) })
          await expect(
            validateElementImportPackage({ blobName }, userTwoCtx)
          ).rejects.toThrow(/try again later/i)

          await clearPackageRateLimitKeys(userTwoCtx)
          const validation = await validateElementImportPackage(
            { blobName },
            userTwoCtx
          )
          expect(validation.importToken).toEqual(expect.any(String))
          await expect(
            importElementPackage(
              {
                importToken: validation.importToken!,
                selectedElementRefs: ['element-1'],
              },
              userTwoCtx
            )
          ).resolves.toEqual({
            importedElements: 1,
            importedAnswerCollections: 1,
            skippedElements: 0,
          })
          await expect(
            importElementPackage(
              {
                importToken: validation.importToken!,
                selectedElementRefs: ['element-1'],
              },
              userTwoCtx
            )
          ).rejects.toThrow(/try again later/i)
        }
      )
    })

    it('returns validation error codes without an import token for invalid uploads', async () => {
      const blobName = `imports/${userTwoCtx.user.sub}/${randomUUID()}-package.zip`
      const missingBlobName = `imports/${userTwoCtx.user.sub}/${randomUUID()}-missing.zip`
      const oversizedBlobName = `imports/${userTwoCtx.user.sub}/${randomUUID()}-oversized.zip`

      await withEnv(
        {
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          await writeLocalImportExportPackageBlob(
            blobName,
            createValidationPackage({}, { options: { choices: [] } })
          )

          await expect(
            validateElementImportPackage({ blobName }, userTwoCtx)
          ).resolves.toMatchObject({
            importToken: null,
            errors: ['IMPORT_INVALID_OPTIONS'],
          })

          await writeLocalImportExportPackageBlob(
            oversizedBlobName,
            Buffer.alloc(10 * 1024 * 1024 + 1)
          )

          await expect(
            validateElementImportPackage(
              { blobName: oversizedBlobName },
              userTwoCtx
            )
          ).resolves.toMatchObject({
            importToken: null,
            errors: ['IMPORT_PACKAGE_TOO_LARGE'],
          })

          await expect(
            validateElementImportPackage(
              { blobName: missingBlobName },
              userTwoCtx
            )
          ).resolves.toMatchObject({
            importToken: null,
            errors: ['IMPORT_PACKAGE_NOT_FOUND'],
          })
        }
      )
    })

    it('cleans up expired local import/export package blobs', async () => {
      const tempDir = await mkdtemp(
        path.join(tmpdir(), 'klicker-import-export-packages-')
      )
      const now = new Date('2026-01-02T12:00:00.000Z')
      const expiredDate = new Date('2026-01-01T00:00:00.000Z')
      const freshDate = new Date('2026-01-02T11:00:00.000Z')
      const expiredImportBlob = `imports/${userOneCtx.user.sub}/expired.zip`
      const expiredExportBlob = `exports/${userOneCtx.user.sub}/expired.zip`
      const freshImportBlob = `imports/${userOneCtx.user.sub}/fresh.zip`

      await withEnv(
        {
          LOCAL_IMPORT_EXPORT_PACKAGE_DIR: tempDir,
          IMPORT_EXPORT_PACKAGE_STORAGE: 'local',
          NODE_ENV: 'test',
        },
        async () => {
          await writeLocalImportExportPackageBlob(
            expiredImportBlob,
            Buffer.from('expired-import')
          )
          await writeLocalImportExportPackageBlob(
            expiredExportBlob,
            Buffer.from('expired-export')
          )
          await writeLocalImportExportPackageBlob(
            freshImportBlob,
            Buffer.from('fresh-import')
          )
          await utimes(
            path.join(tempDir, expiredImportBlob),
            expiredDate,
            expiredDate
          )
          await utimes(
            path.join(tempDir, expiredExportBlob),
            expiredDate,
            expiredDate
          )
          await utimes(
            path.join(tempDir, freshImportBlob),
            freshDate,
            freshDate
          )

          await expect(
            cleanupImportExportPackages({ now, ttlHours: 24 })
          ).resolves.toEqual({ deletedPackages: 2, deletedMediaFiles: 0 })
          await expect(
            readLocalImportExportPackageBlob(expiredImportBlob)
          ).rejects.toThrow()
          await expect(
            readLocalImportExportPackageBlob(expiredExportBlob)
          ).rejects.toThrow()
          await expect(
            readLocalImportExportPackageBlob(freshImportBlob)
          ).resolves.toEqual(Buffer.from('fresh-import'))
        }
      )
    })
  })
})

async function executeExportQuery({
  field,
  selection,
  elementIds,
  ctx,
}: {
  field: string
  selection: string
  elementIds: number[]
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
}) {
  return await graphql({
    schema,
    source: `query ExportPackage($elementIds: [Int!]!) {
      ${field}(elementIds: $elementIds) {
        ${selection}
      }
    }`,
    variableValues: { elementIds },
    contextValue: ctx,
  })
}

async function clearPackageRateLimitKeys(
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
) {
  const keys = await ctx.redisExec.keys('rate-limit:import-export-package:*')
  if (keys.length > 0) {
    await ctx.redisExec.del(...keys)
  }
}

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>
) {
  const previousValues = new Map(
    Object.keys(overrides).map((key) => [key, process.env[key]])
  )

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    return await fn()
  } finally {
    for (const [key, value] of previousValues) {
      if (typeof value === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

async function seedPackageFixture(
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
) {
  const answerCollection = await ctx.prisma.answerCollection.create({
    data: {
      name: 'Import export collection',
      description: 'Items used by portable element packages',
      ownerId: ctx.user.sub,
      entries: {
        create: [{ value: 'Alpha' }, { value: 'Beta' }, { value: 'Gamma' }],
      },
    },
    include: { entries: { orderBy: { value: 'asc' } } },
  })

  const [firstEntry, secondEntry] = answerCollection.entries
  if (!firstEntry || !secondEntry) {
    throw new Error('Test answer collection entries were not created.')
  }

  const singleChoice = await ctx.prisma.element.create({
    data: {
      type: ElementType.SC,
      name: 'Package SC',
      content: 'Single choice content',
      explanation: 'Single choice explanation',
      status: ElementStatus.READY,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: 'Correct', correct: true },
          { ix: 1, value: 'Distractor', correct: false },
        ],
      },
      ownerId: ctx.user.sub,
    },
  })

  const selection = await ctx.prisma.element.create({
    data: {
      type: ElementType.SELECTION,
      name: 'Package Selection',
      content: 'Selection content',
      explanation: 'Selection explanation',
      status: ElementStatus.READY,
      options: {
        hasSampleSolution: true,
        numberOfInputs: 1,
      },
      ownerId: ctx.user.sub,
      answerCollectionId: answerCollection.id,
      answerCollectionItems: {
        connect: [{ id: firstEntry.id }],
      },
    },
  })

  const caseStudy = await ctx.prisma.element.create({
    data: {
      type: ElementType.CASE_STUDY,
      name: 'Package Case Study',
      content: 'Case study content',
      explanation: 'Case study explanation',
      status: ElementStatus.READY,
      options: {
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
            description: 'Case study description',
            order: 0,
            solutions: [
              {
                itemId: firstEntry.id,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 4, max: 5 },
                ],
              },
              {
                itemId: secondEntry.id,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 1, max: 2 },
                ],
              },
            ],
          },
        ],
      },
      ownerId: ctx.user.sub,
      answerCollectionId: answerCollection.id,
      answerCollectionItems: {
        connect: [{ id: firstEntry.id }, { id: secondEntry.id }],
      },
    },
  })

  await recomputeDerivedPermissions(
    { answerCollectionId: answerCollection.id },
    ctx.prisma
  )
  await Promise.all(
    [singleChoice, selection, caseStudy].map((element) =>
      recomputeDerivedPermissions({ elementId: element.id }, ctx.prisma)
    )
  )

  return {
    answerCollection,
    entries: answerCollection.entries,
    singleChoice,
    selection,
    caseStudy,
  }
}

function createValidationPackage(
  manifestOverrides: Partial<Record<string, unknown>> = {},
  elementOverrides: Partial<Record<string, unknown>> = {},
  extraFiles: { path: string; data: Buffer | string }[] = []
) {
  const manifest = {
    type: 'klicker-element-package',
    version: 3,
    createdAt: new Date().toISOString(),
    elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
    answerCollections: [],
    media: [],
    ...manifestOverrides,
  }
  const element = {
    ref: 'element-1',
    name: 'Imported SC',
    content: 'Imported content',
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
    status: ElementStatus.READY,
    ...elementOverrides,
  }

  return createZip([
    { path: 'manifest.json', data: JSON.stringify(manifest) },
    { path: 'elements/element-1.json', data: JSON.stringify(element) },
    ...extraFiles,
  ])
}

function createSelectionValidationPackage({
  manifestAnswerCollectionRef,
  elementAnswerCollectionRef,
  answerCollectionItemRefs,
}: {
  manifestAnswerCollectionRef: string
  elementAnswerCollectionRef: string
  answerCollectionItemRefs: string[]
}) {
  const manifest = {
    type: 'klicker-element-package',
    version: 3,
    createdAt: new Date().toISOString(),
    elements: [
      {
        ref: 'selection-1',
        file: 'elements/selection-1.json',
        answerCollectionRef: manifestAnswerCollectionRef,
      },
    ],
    answerCollections: [
      { ref: 'collection-1', file: 'answer-collections/collection-1.json' },
      { ref: 'collection-2', file: 'answer-collections/collection-2.json' },
    ],
    media: [],
  }
  const collectionOne = {
    ref: 'collection-1',
    name: 'Collection 1',
    description: '',
    entries: [{ ref: 'collection-1-entry-1', value: 'Alpha' }],
  }
  const collectionTwo = {
    ref: 'collection-2',
    name: 'Collection 2',
    description: '',
    entries: [{ ref: 'collection-2-entry-1', value: 'Beta' }],
  }
  const element = {
    ref: 'selection-1',
    name: 'Imported selection',
    content: 'Imported selection content',
    type: ElementType.SELECTION,
    options: {
      hasSampleSolution: true,
      numberOfInputs: 1,
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    status: ElementStatus.READY,
    answerCollectionRef: elementAnswerCollectionRef,
    answerCollectionItemRefs,
  }

  return createZip([
    { path: 'manifest.json', data: JSON.stringify(manifest) },
    {
      path: 'answer-collections/collection-1.json',
      data: JSON.stringify(collectionOne),
    },
    {
      path: 'answer-collections/collection-2.json',
      data: JSON.stringify(collectionTwo),
    },
    { path: 'elements/selection-1.json', data: JSON.stringify(element) },
  ])
}

function createZipWithInvalidEntryPath() {
  const buffer = createZip([{ path: 'safe/entry-file.json', data: 'content' }])
  const from = Buffer.from('safe/entry-file.json')
  const to = Buffer.from('safe/../entry-x.json')
  if (from.length !== to.length) {
    throw new Error('ZIP test path replacement must keep the same length.')
  }

  const rewritten = Buffer.from(buffer)
  let offset = 0
  let replacements = 0

  while ((offset = rewritten.indexOf(from, offset)) !== -1) {
    to.copy(rewritten, offset)
    offset += to.length
    replacements++
  }

  expect(replacements).toBeGreaterThanOrEqual(2)
  return rewritten
}

function createZipWithCentralLocalPathMismatch() {
  const buffer = createZip([{ path: 'safe/file-a.json', data: 'content' }])
  const from = Buffer.from('safe/file-a.json')
  const to = Buffer.from('safe/file-b.json')
  if (from.length !== to.length) {
    throw new Error('ZIP test path replacement must keep the same length.')
  }

  const rewritten = Buffer.from(buffer)
  const offset = rewritten.indexOf(from)
  expect(offset).toBeGreaterThan(-1)
  to.copy(rewritten, offset)
  return rewritten
}

function createZipWithHugeDeclaredSize() {
  const buffer = createZip([{ path: 'small.txt', data: 'x' }])
  const rewritten = Buffer.from(buffer)
  const centralDirectoryOffset = rewritten.readUInt32LE(
    rewritten.length - 22 + 16
  )
  rewritten.writeUInt32LE(0xffff_ffff, centralDirectoryOffset + 24)
  return rewritten
}

function createZipWithDataDescriptorFlags(buffer: Buffer) {
  const rewritten = Buffer.from(buffer)
  const entryCount = rewritten.readUInt16LE(rewritten.length - 22 + 10)
  let centralOffset = rewritten.readUInt32LE(rewritten.length - 22 + 16)

  for (let ix = 0; ix < entryCount; ix++) {
    const fileNameLength = rewritten.readUInt16LE(centralOffset + 28)
    const extraLength = rewritten.readUInt16LE(centralOffset + 30)
    const commentLength = rewritten.readUInt16LE(centralOffset + 32)
    const localHeaderOffset = rewritten.readUInt32LE(centralOffset + 42)

    rewritten.writeUInt16LE(0x0008, centralOffset + 8)
    rewritten.writeUInt16LE(0x0008, localHeaderOffset + 6)
    rewritten.writeUInt32LE(0, localHeaderOffset + 14)
    rewritten.writeUInt32LE(0, localHeaderOffset + 18)
    rewritten.writeUInt32LE(0, localHeaderOffset + 22)

    centralOffset += 46 + fileNameLength + extraLength + commentLength
  }

  return rewritten
}

function createDeterministicBuffer(seed: number, length: number) {
  const buffer = Buffer.alloc(length)
  let value = seed >>> 0

  for (let ix = 0; ix < length; ix++) {
    value = (value * 1664525 + 1013904223) >>> 0
    buffer[ix] = value & 0xff
  }

  return buffer
}

function rewritePackageJson(
  buffer: Buffer,
  rewrites: Record<string, (value: any) => any>
) {
  return createZip(
    parseZip(buffer).map((entry) => {
      const rewrite = rewrites[entry.path]

      return {
        path: entry.path,
        data: rewrite
          ? JSON.stringify(rewrite(JSON.parse(entry.data.toString('utf8'))))
          : entry.data,
      }
    })
  )
}
