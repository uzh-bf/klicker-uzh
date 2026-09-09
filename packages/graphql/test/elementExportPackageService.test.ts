import { ElementStatus, ElementType } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER } from '../src/lib/importExportMediaReferences.js'
import { parseZip } from '../src/lib/zip.js'
import { validateElementImportPackageBuffer } from '../src/services/elementImportExport.js'
import {
  createAvailableImportExportRedis,
  createMediaExportElement,
  expectPublicImportExportError,
  importExportTestUser,
  mockElementExportSnapshot,
  useImportExportTestEnvironment,
  withEnv,
  withMockExportSnapshotTransactions,
} from './elementImportExportTestSupport.js'

describe('Secure element import/export packages', () => {
  useImportExportTestEnvironment()
  it('exports anonymized refs and package-local media references', async () => {
    const elementId = 987_654_321
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/a(b).png'
    const sharedFirstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/shared.png?sig=authored-link'
    const escapedFirstPartyHref = firstPartyHref
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)')
    const mediaData = Buffer.from('exported media bytes')
    const sourceElement = {
      id: elementId,
      name: 'Exported element',
      content: [
        `Question with ![media](${escapedFirstPartyHref})`,
        `![shared inline](${sharedFirstPartyHref})`,
        `[open shared](${sharedFirstPartyHref})`,
        '![shared reference][shared-source]',
        '[open shared reference][shared-source]',
        '',
        `[shared-source]: ${sharedFirstPartyHref}`,
      ].join('\n'),
      options: {
        displayMode: 'LIST',
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        choices: [
          {
            ix: 0,
            value: `Nested ![media](${escapedFirstPartyHref})`,
          },
          { ix: 1, value: 'Plain choice' },
        ],
      },
      type: ElementType.SC,
      pointsMultiplier: 1,
      explanation: `Explanation with ![media](${escapedFirstPartyHref})`,
      version: 42,
      status: ElementStatus.READY,
      answerCollectionId: null,
      answerCollectionItems: [],
      tags: [{ name: 'Confidential source tag' }],
      basePoints: true,
    }

    vi.resetModules()
    mockElementExportSnapshot([sourceElement])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(async () => ({
        buffer: mediaData,
        contentType: 'image/png',
        filename: 'original-source.png',
        originalId: 'source-media-id',
      })),
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFilesExportMetadata: vi.fn(
        async (hrefs: string[]) =>
          new Map(
            hrefs.map((href) => [
              href,
              {
                bytes: mediaData.length,
                contentType: 'image/png',
                filename: 'original-source.png',
                sha256: createHash('sha256').update(mediaData).digest('hex'),
              },
            ])
          )
      ),
      isKlickerMediaFileExportable: vi.fn(),
      parseKlickerMediaUrl: vi.fn((href: string) =>
        href === firstPartyHref || href === sharedFirstPartyHref
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
          prisma: withMockExportSnapshotTransactions({
            element: {
              findMany: vi.fn(async () => [sourceElement]),
            },
          }),
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
      expect(element.content).toContain(
        'Question with ![media](<klicker-package-media://media-1>)'
      )
      expect(element.content).toContain(
        '![shared inline](<klicker-package-media://media-1>)'
      )
      expect(element.content).toContain(
        '![shared reference](<klicker-package-media://media-1>)'
      )
      expect(element.content).toContain(
        `[open shared](${sharedFirstPartyHref})`
      )
      expect(element.content).toContain(
        '[open shared reference][shared-source]'
      )
      expect(element.content).toContain(
        `[shared-source]: ${sharedFirstPartyHref}`
      )
      expect(element.explanation).toBe(
        'Explanation with ![media](<klicker-package-media://media-1>)'
      )
      expect(element.options.choices[0].value).toBe(
        'Nested ![media](<klicker-package-media://media-1>)'
      )
      expect(packageText).not.toContain(firstPartyHref)
      expect(packageText).toContain(sharedFirstPartyHref)
      expect(packageText).not.toContain(String(elementId))
      expect(packageText).not.toContain('source-media-id')
      expect(packageText).not.toContain('"source"')
      expect(packageText).not.toContain('"tags"')
      expect(packageText).not.toContain('Confidential source tag')
      expect(() =>
        validateElementImportPackageBuffer(exported.buffer)
      ).not.toThrow()
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('bundles and rewrites media from answer-collection descriptions', async () => {
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/collection.png'
    const mediaData = Buffer.from('collection media bytes')
    const entry = { id: 401, value: 'Bern', collectionId: 301 }
    const collection = {
      id: 301,
      name: 'Collection with media',
      description: `![collection image](${firstPartyHref})`,
      version: 1,
      entries: [entry],
    }
    const element = {
      id: 201,
      name: 'Selection with collection media',
      content: 'Select the answer',
      options: { hasSampleSolution: true, numberOfInputs: 1 },
      type: ElementType.SELECTION,
      pointsMultiplier: 1,
      explanation: null,
      version: 1,
      status: ElementStatus.READY,
      answerCollectionId: collection.id,
      answerCollectionItems: [entry],
      basePoints: true,
    }

    vi.resetModules()
    mockElementExportSnapshot([element], [collection])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(async () => ({
        buffer: mediaData,
        contentType: 'image/png',
        filename: 'collection.png',
        originalId: 'collection-media-id',
      })),
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata: vi.fn(),
      getKlickerMediaFilesExportMetadata: vi.fn(
        async () =>
          new Map([
            [
              firstPartyHref,
              {
                bytes: mediaData.length,
                contentType: 'image/png',
                filename: 'collection.png',
                sha256: createHash('sha256').update(mediaData).digest('hex'),
              },
            ],
          ])
      ),
      parseKlickerMediaUrl: vi.fn((href: string) =>
        href === firstPartyHref
          ? {
              containerName: 'source-owner',
              blobName: 'imported/collection.png',
            }
          : null
      ),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const {
        createElementExportPackage: createWithMockedMedia,
        validateElementImportPackageBuffer: validateWithMockedMedia,
      } = await import('../src/services/elementImportExport.js')
      const exported = await createWithMockedMedia(
        { elementIds: [element.id] },
        {
          user: importExportTestUser('owner-id'),
          prisma: withMockExportSnapshotTransactions({
            element: { findMany: vi.fn(async () => [element]) },
            answerCollection: {
              findMany: vi.fn(async () => [
                {
                  ...collection,
                  _count: { entries: collection.entries.length },
                },
              ]),
            },
            answerCollectionEntry: {
              findMany: vi.fn(async () =>
                collection.entries.map((entry) => ({
                  ...entry,
                  collectionId: collection.id,
                }))
              ),
            },
          }),
        } as any
      )
      const entries = parseZip(exported.buffer)
      const manifest = JSON.parse(
        entries
          .find((zipEntry) => zipEntry.path === 'manifest.json')!
          .data.toString('utf8')
      )
      const exportedCollection = JSON.parse(
        entries
          .find(
            (zipEntry) =>
              zipEntry.path === 'answer-collections/answer-collection-1.json'
          )!
          .data.toString('utf8')
      )

      expect(manifest.media).toHaveLength(1)
      expect(exportedCollection.description).toBe(
        '![collection image](<klicker-package-media://media-1>)'
      )
      expect(validateWithMockedMedia(exported.buffer).warnings).toEqual([
        'IMPORT_STATUS_NORMALIZED_TO_REVIEW',
      ])
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('replaces external, unavailable, oversized, and SVG export images with omission markers', async () => {
    const oversizedHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/too-large.png'
    const unavailableHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/unavailable.png'
    const svgHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/vector.svg'
    const externalHref =
      'https://tracker.example.test/pixel.png?signature=private'
    const hrefs = [externalHref, unavailableHref, oversizedHref, svgHref]
    const element = {
      ...createMediaExportElement(oversizedHref),
      content: hrefs
        .map((href, index) => `![omitted ${index + 1}](<${href}>)`)
        .join('\n'),
    }
    const svgData = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')

    vi.resetModules()
    mockElementExportSnapshot([element])
    const { MediaExportOmissionError } = await import(
      '../src/lib/mediaErrors.js'
    )
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(async (href: string) => {
        if (href === unavailableHref) return null
        if (href === oversizedHref) {
          throw new MediaExportOmissionError('too-large')
        }
        if (href === svgHref) {
          return {
            buffer: svgData,
            contentType: 'image/svg+xml',
            filename: 'vector.svg',
            originalId: 'source-svg-id',
          }
        }
        throw new Error('Unexpected media download')
      }),
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata: vi.fn(),
      getKlickerMediaFilesExportMetadata: vi.fn(
        async () =>
          new Map([
            [unavailableHref, null],
            [oversizedHref, null],
            [svgHref, null],
          ])
      ),
      parseKlickerMediaUrl: vi.fn((href: string) =>
        [unavailableHref, oversizedHref, svgHref].includes(href)
          ? {
              containerName: 'source-owner',
              blobName: new URL(href).pathname,
            }
          : null
      ),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const {
        createElementExportPackage: createWithMockedMedia,
        validateElementImportPackageBuffer: validateWithMockedMedia,
      } = await import('../src/services/elementImportExport.js')
      const exported = await createWithMockedMedia(
        { elementIds: [element.id] },
        {
          user: { sub: 'owner-id' },
          prisma: {
            element: {
              findMany: vi.fn(async () => [element]),
            },
          },
        } as any
      )

      const manifest = JSON.parse(
        parseZip(exported.buffer)
          .find((entry) => entry.path === 'manifest.json')!
          .data.toString('utf8')
      )
      expect(manifest.media).toEqual([])
      expect(manifest.warnings).toEqual([
        'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED',
        'IMPORT_MEDIA_NOT_INCLUDED',
      ])

      const exportedElement = JSON.parse(
        parseZip(exported.buffer)
          .find((entry) => entry.path === 'elements/element-1.json')!
          .data.toString('utf8')
      )
      expect(
        exportedElement.content.split(IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER)
      ).toHaveLength(hrefs.length + 1)
      for (const href of hrefs) {
        expect(exportedElement.content).not.toContain(href)
      }

      const preview = validateWithMockedMedia(exported.buffer)
      expect(preview.warnings).toEqual(['IMPORT_STATUS_NORMALIZED_TO_REVIEW'])
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('omits SVG media without classifying the export as non-portable', async () => {
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/vector.svg'
    const element = createMediaExportElement(firstPartyHref)
    const mediaData = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'
    )

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(async () => ({
        buffer: mediaData,
        contentType: 'image/svg+xml',
        filename: 'vector.svg',
        originalId: 'source-svg-id',
      })),
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata: vi.fn(async () => null),
      getKlickerMediaFilesExportMetadata: vi.fn(
        async () => new Map([[firstPartyHref, null]])
      ),
      parseKlickerMediaUrl: vi.fn((href: string) =>
        href === firstPartyHref
          ? {
              containerName: 'source-owner',
              blobName: 'imported/vector.svg',
            }
          : null
      ),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const {
        createElementExportPackage: createWithMockedMedia,
        getElementExportPackagePreview: previewWithMockedMedia,
        validateElementImportPackageBuffer: validateWithMockedMedia,
      } = await import('../src/services/elementImportExport.js')
      const ctx = {
        user: importExportTestUser('owner-id'),
        redisExec: createAvailableImportExportRedis(),
        prisma: {
          element: {
            findMany: vi.fn(async () => [element]),
          },
        },
      } as any

      await expect(
        previewWithMockedMedia({ elementIds: [element.id] }, ctx)
      ).resolves.toMatchObject({
        elements: [{ id: element.id }],
        warnings: ['IMPORT_MEDIA_NOT_INCLUDED'],
        errors: [],
      })

      const exported = await createWithMockedMedia(
        { elementIds: [element.id] },
        ctx
      )
      const manifest = JSON.parse(
        parseZip(exported.buffer)
          .find((entry) => entry.path === 'manifest.json')!
          .data.toString('utf8')
      )
      expect(manifest.media).toEqual([])
      expect(manifest.warnings).toEqual(['IMPORT_MEDIA_NOT_INCLUDED'])
      const exportedElement = JSON.parse(
        parseZip(exported.buffer)
          .find((entry) => entry.path === 'elements/element-1.json')!
          .data.toString('utf8')
      )
      expect(exportedElement.content).toContain(
        IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER
      )
      expect(exportedElement.content).not.toContain(firstPartyHref)
      expect(validateWithMockedMedia(exported.buffer).warnings).toEqual([
        'IMPORT_STATUS_NORMALIZED_TO_REVIEW',
      ])
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('does not downgrade unexpected media storage errors and redacts them at the public export boundary', async () => {
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/private.png'
    const sensitiveText =
      'https://secret-account.blob.core.windows.net/private?sig=storage-secret'
    const storageError = new Error(sensitiveText)
    const element = createMediaExportElement(firstPartyHref)
    const ctx = {
      user: importExportTestUser('owner-id'),
      redisExec: createAvailableImportExportRedis(),
      prisma: withMockExportSnapshotTransactions({
        element: {
          findMany: vi.fn(async () => [element]),
        },
      }),
    }

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(async () => {
        throw storageError
      }),
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata: vi.fn(),
      getKlickerMediaFilesExportMetadata: vi.fn(
        async () =>
          new Map([
            [
              firstPartyHref,
              {
                bytes: 32,
                contentType: 'image/png',
                filename: 'private.png',
                sha256: 'a'.repeat(64),
              },
            ],
          ])
      ),
      parseKlickerMediaUrl: vi.fn((href: string) =>
        href === firstPartyHref
          ? {
              containerName: 'source-owner',
              blobName: 'imported/private.png',
            }
          : null
      ),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const {
        createElementExportPackage: createWithMockedMedia,
        getElementExportPackageLink: getLinkWithMockedMedia,
      } = await import('../src/services/elementImportExport.js')

      await expect(
        createWithMockedMedia({ elementIds: [element.id] }, ctx as any)
      ).rejects.toBe(storageError)

      await withEnv(
        {
          IMPORT_EXPORT_ENABLED: 'true',
          IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY: 'false',
        },
        async () => {
          const publicError = await expectPublicImportExportError(
            getLinkWithMockedMedia({ elementIds: [element.id] }, ctx as any),
            ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
            sensitiveText
          )
          expect((publicError as Error).name).toBe('GraphQLError')
          expect(Object.getPrototypeOf(publicError)?.constructor?.name).toBe(
            'GraphQLError'
          )
        }
      )
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })
})
