import { ElementType } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import {
  assertImportExportPackageStorageConfig,
  assertImportExportTokenSecretConfig,
} from '../src/index.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER } from '../src/lib/importExportMediaReferences.js'
import { createZip, parseZip } from '../src/lib/zip.js'
import {
  getElementExportPackageLink,
  getElementExportPackagePreview,
  importElementPackage,
  prepareElementImportPackageUpload,
  validateElementImportPackage,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'
import { assertImportExportRateLimit } from '../src/services/importExportRateLimit.js'
import {
  createDeterministicBuffer,
  createValidationPackage,
  createZipWithCentralLocalPathMismatch,
  createZipWithDataDescriptorFlags,
  createZipWithHugeDeclaredSize,
  expectImportValidationError,
  expectPublicImportExportError,
  importExportTestUser,
  useImportExportTestEnvironment,
  withEnv,
} from './elementImportExportTestSupport.js'

describe('Secure element import/export packages', () => {
  useImportExportTestEnvironment()
  it('rejects element-file tags as outside the package contract', () => {
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, { tags: ['Hello 123', 'Week 1'] })
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('keeps unrelated ZIP metadata failures independent of tag handling', () => {
    expect(() => createZip([{ path: 'elements/', data: '' }])).toThrow(
      /invalid zip entry path/i
    )
    const metadataFiles = [
      { path: '.DS_Store', data: 'metadata' },
      { path: 'elements/.DS_Store', data: 'metadata' },
      { path: '__MACOSX/._manifest.json', data: 'metadata' },
      { path: '__MACOSX/elements/._element-1.json', data: 'metadata' },
    ]

    for (const metadataFile of metadataFiles) {
      expectImportValidationError(
        () =>
          validateElementImportPackageBuffer(
            createValidationPackage({}, {}, [metadataFile])
          ),
        ImportExportErrorCode.INVALID_PACKAGE
      )
    }
  })

  it('rejects packages wrapped in a single enclosing folder', () => {
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
        }),
      },
    ])
    expectImportValidationError(
      () => validateElementImportPackageBuffer(wrappedPackage),
      ImportExportErrorCode.MANIFEST_NOT_AT_ROOT
    )
  })

  it('rejects packages containing all common macOS ZIP metadata entries', () => {
    expect(() => createZip([{ path: 'elements/', data: '' }])).toThrow(
      /invalid zip entry path/i
    )
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, {}, [
            { path: '.DS_Store', data: 'metadata' },
            { path: 'elements/.DS_Store', data: 'metadata' },
            { path: '__MACOSX/._manifest.json', data: 'metadata' },
            { path: '__MACOSX/elements/._element-1.json', data: 'metadata' },
          ])
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('rejects manifest-level element tags as a generic invalid package', () => {
    const buffer = createValidationPackage({
      elements: [
        {
          ref: 'element-1',
          file: 'elements/element-1.json',
          tags: ['Hello 123'],
        },
      ],
    })
    expectImportValidationError(
      () => validateElementImportPackageBuffer(buffer),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('rejects unknown warnings, ignores forged known warnings, and classifies unsupported headers', () => {
    const authoredWarningPackage = createValidationPackage({
      warnings: ['Package author says this is safe'],
    })
    const forgedKnownWarningPackage = createValidationPackage(
      {
        warnings: ['IMPORT_CLEANUP_PENDING'],
      },
      {}
    )
    const unsupportedVersionPackage = createValidationPackage({ version: 999 })

    expectImportValidationError(
      () => validateElementImportPackageBuffer(authoredWarningPackage),
      ImportExportErrorCode.INVALID_PACKAGE
    )
    expectImportValidationError(
      () => validateElementImportPackageBuffer(unsupportedVersionPackage),
      ImportExportErrorCode.UNSUPPORTED_PACKAGE
    )
    expect(
      validateElementImportPackageBuffer(forgedKnownWarningPackage).warnings
    ).toEqual(['IMPORT_STATUS_NORMALIZED_TO_REVIEW'])
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({ type: 'another-package-format' })
        ),
      ImportExportErrorCode.UNSUPPORTED_PACKAGE
    )
  })

  it('rejects packages whose manifest is nested too deeply', () => {
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
        }),
      },
    ])
    expectImportValidationError(
      () => validateElementImportPackageBuffer(nestedPackage),
      ImportExportErrorCode.MANIFEST_NOT_AT_ROOT
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

  it('rejects ZIP data-descriptor entries', () => {
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createZipWithDataDescriptorFlags(createValidationPackage())
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
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

  it('requires at least 32 bytes of import/export token entropy in production', async () => {
    await withEnv(
      {
        IMPORT_EXPORT_TOKEN_SECRET: 'too-short',
        NODE_ENV: 'production',
      },
      async () => {
        expect(() => assertImportExportTokenSecretConfig()).toThrow(/32 bytes/)
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
          user: importExportTestUser('rate-limit-user'),
          redisExec: {
            eval: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
          },
        }
        await expect(
          assertImportExportRateLimit(unavailableCtx as any, 'upload')
        ).rejects.toMatchObject({
          code: ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE,
        })

        const exceededCtx = {
          user: importExportTestUser('rate-limit-user'),
          redisExec: {
            eval: vi.fn().mockResolvedValue([0, 1]),
          },
        }
        await expect(
          assertImportExportRateLimit(exceededCtx as any, 'upload')
        ).rejects.toMatchObject({
          code: ImportExportErrorCode.RATE_LIMITED,
        })
      }
    )
  })

  it('redacts authorization infrastructure failures across every public operation', async () => {
    const sensitiveText = 'postgresql://secret-user@private-db/import-export'
    const ctx = {
      user: importExportTestUser('preview-user'),
      prisma: {
        user: {
          findUnique: vi.fn().mockRejectedValue(new Error(sensitiveText)),
        },
      },
    }

    await withEnv(
      {
        IMPORT_EXPORT_ENABLED: 'true',
        IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY: 'true',
      },
      async () => {
        await expectPublicImportExportError(
          getElementExportPackageLink({ elementIds: [1] }, ctx as any),
          ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
          sensitiveText
        )
        await expectPublicImportExportError(
          getElementExportPackagePreview({ elementIds: [1] }, ctx as any),
          ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
          sensitiveText
        )
        await expectPublicImportExportError(
          prepareElementImportPackageUpload(
            { filename: 'package.zip', bytes: 1024 },
            ctx as any
          ),
          ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
          sensitiveText
        )
        await expectPublicImportExportError(
          validateElementImportPackage(
            { artifactId: '00000000-0000-4000-8000-000000000001' },
            ctx as any
          ),
          ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
          sensitiveText
        )
        await expectPublicImportExportError(
          importElementPackage(
            { importToken: 'not-read', selectedElementRefs: ['element-1'] },
            ctx as any
          ),
          ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
          sensitiveText
        )
      }
    )
  })

  it('stages packaged media before opening the import transaction', async () => {
    const calls: string[] = []
    let executedPlan: any
    const sourceHref = 'klicker-package-media://media-1'
    const escapedSourceHref = sourceHref.replaceAll('-', '\\-')
    const importedHref =
      'https://testaccount.blob.core.windows.net/importer/imported/staged.png'
    const mediaData = Buffer.from('media staged before transaction')
    const sha256 = createHash('sha256').update(mediaData).digest('hex')
    const downloadKlickerMediaFile = vi.fn()

    vi.resetModules()
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(async () => {
        calls.push('cleanup')
      }),
      downloadKlickerMediaFile,
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
          contentHash: sha256,
          createdBlob: true,
        }
      }),
    }))
    vi.doMock('../src/services/elementImportExecution.js', () => ({
      executeElementImportExecutionPlan: vi.fn(async ({ plan }) => {
        calls.push('execute')
        executedPlan = plan
        return {
          createdElementIds: [123],
          createdAnswerCollectionIds: [],
          invalidations: [{ typename: 'Element', id: 123 }],
        }
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
              filename: 'media-1.png',
              contentType: 'image/png',
              bytes: mediaData.length,
              sha256,
              sourceHref,
            },
          ],
        },
        {
          content: `Imported content ![media](${escapedSourceHref}) ![tracker](https://example.com/tracker.png) [safe link](https://example.com/tracker.png)`,
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
        'execute',
      ])
      expect(executedPlan.elements[0]).not.toHaveProperty('tags')
      expect(executedPlan.elements[0].content).toBe(
        `Imported content ![media](<${importedHref}>) \\[${IMPORTED_EXTERNAL_MEDIA_OMISSION_MARKER}\\: tracker\\] [safe link](https://example.com/tracker.png)`
      )
      expect(downloadKlickerMediaFile).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementImportExecution.js')
      vi.resetModules()
    }
  })

  it('stages and rewrites packaged media required by an answer collection', async () => {
    const sourceHref = 'klicker-package-media://collection-media'
    const importedHref =
      'https://testaccount.blob.core.windows.net/importer/imported/collection.png'
    const mediaData = Buffer.from('imported collection media')
    const sha256 = createHash('sha256').update(mediaData).digest('hex')
    let executedPlan: any

    vi.resetModules()
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(),
      finalizeStagedImportedMediaFile: vi.fn(async () => ({
        href: importedHref,
        unusedStagedHref: null,
      })),
      getKlickerMediaFileExportMetadata: vi.fn(),
      parseKlickerMediaUrl: vi.fn(),
      stageImportedMediaFile: vi.fn(async () => ({
        id: '22222222-2222-2222-2222-222222222222',
        href: importedHref,
        ownerId: 'importer',
        contentType: 'image/png',
        filename: 'collection.png',
        originalId: `import-media:${sha256}`,
        contentHash: sha256,
        createdBlob: true,
      })),
    }))
    vi.doMock('../src/services/elementImportExecution.js', () => ({
      executeElementImportExecutionPlan: vi.fn(async ({ plan }) => {
        executedPlan = plan
        return {
          createdElementIds: [123],
          createdAnswerCollectionIds: [77],
          invalidations: [
            { typename: 'AnswerCollection', id: 77 },
            { typename: 'Element', id: 123 },
          ],
        }
      }),
    }))

    try {
      const { importElementPackageBuffer: importWithMockedCollectionMedia } =
        await import('../src/services/elementImportExport.js')
      const collection = {
        ref: 'collection-1',
        name: 'Imported collection',
        description:
          '![collection](klicker\\-package\\-media://collection\\-media)',
        entries: [
          {
            ref: 'entry-1',
            value: `Media source: ${sourceHref}`,
          },
          {
            ref: 'entry-2',
            value: 'A deliberately second entry',
          },
        ],
      }
      const element = {
        ref: 'selection-1',
        name: 'Imported selection',
        content: 'Select one',
        type: ElementType.SELECTION,
        options: { hasSampleSolution: true, numberOfInputs: 1 },
        pointsMultiplier: 1,
        basePoints: true,
        explanation: null,
        answerCollectionRef: collection.ref,
        answerCollectionItemRefs: ['entry-1'],
      }
      const media = {
        ref: 'collection-media',
        file: 'media/collection-media.png',
        filename: 'collection-media.png',
        contentType: 'image/png',
        bytes: mediaData.length,
        sha256,
        sourceHref,
      }
      const buffer = createZip([
        {
          path: 'manifest.json',
          data: JSON.stringify({
            type: 'klicker-element-package',
            version: 3,
            createdAt: new Date().toISOString(),
            elements: [
              {
                ref: element.ref,
                file: 'elements/selection-1.json',
                answerCollectionRef: collection.ref,
              },
            ],
            answerCollections: [
              {
                ref: collection.ref,
                file: 'answer-collections/collection-1.json',
              },
            ],
            media: [media],
          }),
        },
        {
          path: 'elements/selection-1.json',
          data: JSON.stringify(element),
        },
        {
          path: 'answer-collections/collection-1.json',
          data: JSON.stringify(collection),
        },
        { path: media.file, data: mediaData },
      ])
      const txPrisma = {}
      const ctx = {
        user: { sub: 'importer' },
        emitter: { emit: vi.fn() },
        prisma: {
          element: { findMany: vi.fn(async () => []) },
          $transaction: vi.fn(async (fn) => await fn(txPrisma)),
        },
      }

      await expect(
        importWithMockedCollectionMedia(
          { buffer, selectedElementRefs: [element.ref] },
          ctx as any
        )
      ).resolves.toEqual({
        importedElements: 1,
        importedAnswerCollections: 1,
        skippedElements: 0,
      })
      expect(executedPlan.answerCollections[0].description).toBe(
        `![collection](<${importedHref}>)`
      )
      expect(executedPlan.answerCollections[0].entries[0].value).toBe(
        `Media source: ${importedHref}`
      )
      expect(executedPlan.elements[0].answerCollectionItemRefs).toEqual([
        'entry-1',
      ])
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementImportExecution.js')
      vi.resetModules()
    }
  })

  it('rejects source metadata in v3 packages', () => {
    expectImportValidationError(
      () =>
        validateElementImportPackageBuffer(
          createValidationPackage({}, { source: { id: 'source-element-1' } })
        ),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })

  it('imports selected elements without duplicate skip behavior', async () => {
    const calls: string[] = []

    vi.resetModules()
    vi.doMock('../src/services/elementImportExecution.js', () => ({
      executeElementImportExecutionPlan: vi.fn(async () => {
        calls.push('execute')
        return {
          createdElementIds: [123],
          createdAnswerCollectionIds: [],
          invalidations: [{ typename: 'Element', id: 123 }],
        }
      }),
    }))

    try {
      const { importElementPackageBuffer: importWithMockedElements } =
        await import('../src/services/elementImportExport.js')
      const txPrisma = {}
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
      expect(calls).toEqual(['transaction-start', 'execute'])
      expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock('../src/services/elementImportExecution.js')
      vi.resetModules()
    }
  })
})
