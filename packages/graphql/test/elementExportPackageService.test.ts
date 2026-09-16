import { ElementStatus, ElementType } from '@klicker-uzh/prisma/client'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { parseZip } from '../src/lib/zip.js'
import { validateElementImportPackageBuffer } from '../src/services/elementImportExport.js'
import {
  createMediaExportElement,
  importExportTestUser,
  mockElementExportSnapshot,
  useImportExportTestEnvironment,
  withMockExportSnapshotTransactions,
} from './elementImportExportTestSupport.js'

function mockPublicMediaStorage(href: string) {
  const downloadKlickerMediaFile = vi.fn()
  const getKlickerMediaFilesExportMetadata = vi.fn()
  vi.doMock('../src/services/mediaStorage.js', () => ({
    downloadKlickerMediaFile,
    getKlickerMediaFilesExportMetadata,
    parseKlickerMediaUrl: vi.fn(() => ({
      containerName: 'source-owner',
      blobName: 'imported/image.png',
    })),
    resolveKlickerMediaHref: vi.fn((value: string) =>
      value === href
        ? { containerName: 'source-owner', blobName: 'imported/image.png' }
        : null
    ),
  }))
  return { downloadKlickerMediaFile, getKlickerMediaFilesExportMetadata }
}

function cleanupMocks() {
  vi.doUnmock('../src/services/mediaStorage.js')
  vi.doUnmock('../src/services/elementExportSnapshot.js')
  vi.resetModules()
}

describe('Secure element import/export packages', () => {
  useImportExportTestEnvironment()

  it('exports JSON only, preserves first-party URLs, and never reads media storage', async () => {
    const href =
      'https://testaccount.blob.core.windows.net/source-owner/imported/image.png'
    const element = {
      ...createMediaExportElement(href),
      content: `Question with ![media](${href})`,
      explanation: `Explanation with ![media](${href})`,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: `Nested ![media](${href})` },
          { ix: 1, value: 'Plain choice' },
        ],
      },
      type: ElementType.SC,
      status: ElementStatus.READY,
      tags: [{ name: 'Confidential source tag' }],
    }

    vi.resetModules()
    mockElementExportSnapshot([element])
    const media = mockPublicMediaStorage(href)
    try {
      const { createElementExportPackage } = await import(
        '../src/services/elementImportExport.js'
      )
      const exported = await createElementExportPackage(
        { elementIds: [element.id] },
        {
          user: importExportTestUser('owner-id'),
          prisma: withMockExportSnapshotTransactions({
            element: { findMany: vi.fn(async () => [element]) },
          }),
        } as any
      )
      const entries = parseZip(exported.buffer)
      const manifest = JSON.parse(
        entries.find((entry) => entry.path === 'manifest.json')!.data.toString()
      )
      const serialized = entries
        .filter((entry) => entry.path.endsWith('.json'))
        .map((entry) => entry.data.toString())
        .join('\n')

      expect(entries.map((entry) => entry.path)).toEqual([
        'manifest.json',
        'elements/element-1.json',
      ])
      expect(manifest.media).toEqual([])
      expect(serialized).toContain(href)
      expect(serialized).not.toContain('klicker-package-media://')
      expect(serialized).not.toContain('Confidential source tag')
      expect(media.downloadKlickerMediaFile).not.toHaveBeenCalled()
      expect(media.getKlickerMediaFilesExportMetadata).not.toHaveBeenCalled()
      expect(() =>
        validateElementImportPackageBuffer(exported.buffer)
      ).not.toThrow()
    } finally {
      cleanupMocks()
    }
  })

  it('preserves first-party URLs in answer-collection JSON without media files', async () => {
    const href =
      'https://testaccount.blob.core.windows.net/source-owner/imported/collection.png'
    const entry = { id: 401, value: 'Bern', collectionId: 301 }
    const collection = {
      id: 301,
      name: 'Collection with media',
      description: `![collection image](${href})`,
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
    const media = mockPublicMediaStorage(href)
    try {
      const { createElementExportPackage } = await import(
        '../src/services/elementImportExport.js'
      )
      const exported = await createElementExportPackage(
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
              findMany: vi.fn(async () => collection.entries),
            },
          }),
        } as any
      )
      const entries = parseZip(exported.buffer)
      const manifest = JSON.parse(
        entries.find((entry) => entry.path === 'manifest.json')!.data.toString()
      )
      const exportedCollection = JSON.parse(
        entries
          .find(
            (entry) =>
              entry.path === 'answer-collections/answer-collection-1.json'
          )!
          .data.toString()
      )

      expect(manifest.media).toEqual([])
      expect(exportedCollection.description).toContain(href)
      expect(exportedCollection.description).not.toContain(
        'klicker-package-media://'
      )
      expect(media.downloadKlickerMediaFile).not.toHaveBeenCalled()
      expect(media.getKlickerMediaFilesExportMetadata).not.toHaveBeenCalled()
    } finally {
      cleanupMocks()
    }
  })

  it('rejects auto-loading external media as non-portable', async () => {
    const href = 'https://tracker.example.test/pixel.png'
    const element = createMediaExportElement(href)

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      downloadKlickerMediaFile: vi.fn(),
      getKlickerMediaFilesExportMetadata: vi.fn(),
      parseKlickerMediaUrl: vi.fn(() => null),
      resolveKlickerMediaHref: vi.fn(() => null),
    }))
    try {
      const { createElementExportPackage } = await import(
        '../src/services/elementImportExport.js'
      )
      await expect(
        createElementExportPackage({ elementIds: [element.id] }, {
          user: importExportTestUser('owner-id'),
          prisma: withMockExportSnapshotTransactions({
            element: { findMany: vi.fn(async () => [element]) },
          }),
        } as any)
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
      })
    } finally {
      cleanupMocks()
    }
  })

  it('does not invoke failing storage adapters for JSON-only exports', async () => {
    const href =
      'https://testaccount.blob.core.windows.net/source-owner/imported/private.png'
    const element = createMediaExportElement(href)
    const downloadKlickerMediaFile = vi.fn(() => {
      throw new Error('storage read must not occur')
    })
    const getKlickerMediaFilesExportMetadata = vi.fn(() => {
      throw new Error('metadata read must not occur')
    })

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      downloadKlickerMediaFile,
      getKlickerMediaFilesExportMetadata,
      parseKlickerMediaUrl: vi.fn(() => ({
        containerName: 'source-owner',
        blobName: 'imported/private.png',
      })),
      resolveKlickerMediaHref: vi.fn(() => ({
        containerName: 'source-owner',
        blobName: 'imported/private.png',
      })),
    }))
    try {
      const { createElementExportPackage } = await import(
        '../src/services/elementImportExport.js'
      )
      await expect(
        createElementExportPackage({ elementIds: [element.id] }, {
          user: importExportTestUser('owner-id'),
          prisma: withMockExportSnapshotTransactions({
            element: { findMany: vi.fn(async () => [element]) },
          }),
        } as any)
      ).resolves.toMatchObject({ filename: expect.stringMatching(/\.zip$/) })
      expect(downloadKlickerMediaFile).not.toHaveBeenCalled()
      expect(getKlickerMediaFilesExportMetadata).not.toHaveBeenCalled()
    } finally {
      cleanupMocks()
    }
  })
})
