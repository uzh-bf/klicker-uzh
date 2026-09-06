import { ElementStatus, ElementType } from '@klicker-uzh/prisma/client'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_PACKAGE_BYTES } from '../src/lib/importExportPackageConfig.js'
import {
  createElementExportPackage,
  getElementExportPackagePreview,
  validateElementImportPackageBuffer,
} from '../src/services/elementImportExport.js'
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

  it('fences a preview when lease ownership is lost during media metadata loading', async () => {
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/deferred.png'
    const element = createMediaExportElement(firstPartyHref)
    type DeferredMediaMetadata = Map<
      string,
      {
        bytes: number
        contentType: string
        filename: string
        originalId: string
        sha256: string
      }
    >
    let resolveMetadata!: (metadata: DeferredMediaMetadata) => void
    const metadataPromise = new Promise<DeferredMediaMetadata>((resolve) => {
      resolveMetadata = resolve
    })
    const getKlickerMediaFilesExportMetadata = vi.fn(
      async () => await metadataPromise
    )
    const evalRedis = vi.fn(
      async (script: string): Promise<number | number[]> => {
        if (script.includes('return {1, count + 1}')) return [1, 1]
        if (script.includes('ZSCORE')) return 0
        return 1
      }
    )
    const redisExec = { eval: evalRedis }
    const ctx = {
      user: importExportTestUser('owner-id'),
      redisExec,
      prisma: {},
    }

    vi.useFakeTimers()
    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      downloadKlickerMediaFile: vi.fn(),
      getKlickerMediaFilesExportMetadata,
      parseKlickerMediaUrl: vi.fn((href: string) =>
        href === firstPartyHref
          ? {
              containerName: 'source-owner',
              blobName: 'imported/deferred.png',
            }
          : null
      ),
    }))

    try {
      const { getElementExportPackagePreview: getPreviewWithDeferredMedia } =
        await import('../src/services/elementExportPackage.js')

      await withEnv(
        {
          IMPORT_EXPORT_ENABLED: 'true',
          IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY: 'false',
          IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS: '3000',
        },
        async () => {
          const preview = getPreviewWithDeferredMedia(
            { elementIds: [element.id] },
            ctx as any
          )
          await vi.advanceTimersByTimeAsync(0)
          expect(getKlickerMediaFilesExportMetadata).toHaveBeenCalledOnce()

          await vi.advanceTimersByTimeAsync(1_001)
          expect(redisExec.eval).toHaveBeenCalledWith(
            expect.stringContaining('ZSCORE'),
            2,
            'concurrency:{import-export-package}:preview:user:owner-id',
            'concurrency:{import-export-package}:preview:global',
            expect.any(String),
            expect.any(Number),
            3_000
          )

          resolveMetadata(
            new Map([
              [
                firstPartyHref,
                {
                  bytes: 1,
                  contentType: 'image/png',
                  filename: 'deferred.png',
                  originalId: 'media-original-id',
                  sha256: 'a'.repeat(64),
                },
              ],
            ])
          )
          const publicError = await expectPublicImportExportError(
            preview,
            ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE
          )
          expect((publicError as Error).name).toBe('GraphQLError')
          expect(redisExec.eval).toHaveBeenCalledWith(
            expect.stringContaining("redis.call('ZREM'"),
            2,
            'concurrency:{import-export-package}:preview:user:owner-id',
            'concurrency:{import-export-package}:preview:global',
            expect.any(String)
          )
        }
      )
    } finally {
      vi.useRealTimers()
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('does not downgrade unexpected media metadata errors in export previews', async () => {
    const firstPartyHref =
      'https://testaccount.blob.core.windows.net/source-owner/imported/metadata.png'
    const sensitiveText =
      'https://secret-account.blob.core.windows.net/private?sig=metadata-secret'
    const metadataError = new Error(sensitiveText)
    const element = createMediaExportElement(firstPartyHref)
    const getKlickerMediaFileExportMetadata = vi.fn(async () => {
      throw metadataError
    })
    const getKlickerMediaFilesExportMetadata = vi.fn(async () => {
      throw metadataError
    })
    const ctx = {
      user: importExportTestUser('owner-id'),
      redisExec: createAvailableImportExportRedis(),
      prisma: {
        element: {
          findMany: vi.fn(async () => [element]),
        },
      },
    }

    vi.resetModules()
    mockElementExportSnapshot([element])
    vi.doMock('../src/services/mediaStorage.js', () => ({
      deleteImportedMediaFile: vi.fn(),
      downloadKlickerMediaFile: vi.fn(),
      finalizeStagedImportedMediaFile: vi.fn(),
      getKlickerMediaFileExportMetadata,
      getKlickerMediaFilesExportMetadata,
      parseKlickerMediaUrl: vi.fn((href: string) =>
        href === firstPartyHref
          ? {
              containerName: 'source-owner',
              blobName: 'imported/metadata.png',
            }
          : null
      ),
      stageImportedMediaFile: vi.fn(),
    }))

    try {
      const { getElementExportPackagePreview: getPreviewWithMockedMedia } =
        await import('../src/services/elementImportExport.js')

      await withEnv(
        {
          IMPORT_EXPORT_ENABLED: 'true',
          IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY: 'false',
        },
        async () => {
          const publicError = await expectPublicImportExportError(
            getPreviewWithMockedMedia({ elementIds: [element.id] }, ctx as any),
            ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
            sensitiveText
          )
          expect((publicError as Error).name).toBe('GraphQLError')
        }
      )
      expect(getKlickerMediaFilesExportMetadata).toHaveBeenCalledOnce()
      expect(getKlickerMediaFileExportMetadata).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock('../src/services/mediaStorage.js')
      vi.doUnmock('../src/services/elementExportSnapshot.js')
      vi.resetModules()
    }
  })

  it('keeps export answer-collection cardinality within the import contract', async () => {
    function createExportFixture(collectionCount: number) {
      const answerCollections = Array.from(
        { length: collectionCount },
        (_, index) => ({
          id: index + 1,
          name: `Pool ${index + 1}`,
          description: 'Portable pool',
          version: 1,
          entries: [{ id: 10_000 + index, value: `Entry ${index + 1}` }],
        })
      )
      const elements = answerCollections.map((collection, index) => ({
        id: index + 1,
        name: `Selection ${index + 1}`,
        content: `Selection content ${index + 1}`,
        options: { hasSampleSolution: true, numberOfInputs: 1 },
        type: ElementType.SELECTION,
        pointsMultiplier: 1,
        explanation: null,
        version: 1,
        status: ElementStatus.READY,
        answerCollectionId: collection.id,
        answerCollectionItems: [collection.entries[0]!],
        basePoints: true,
      }))

      return {
        elementIds: elements.map((element) => element.id),
        ctx: {
          user: importExportTestUser('owner-id'),
          redisExec: createAvailableImportExportRedis(),
          prisma: withMockExportSnapshotTransactions({
            element: {
              findMany: vi.fn(async ({ where }) =>
                elements.filter((element) => where.id.in.includes(element.id))
              ),
            },
            answerCollection: {
              findMany: vi.fn(async () =>
                answerCollections
                  .map((collection) => ({
                    ...collection,
                    _count: { entries: collection.entries.length },
                  }))
                  .reverse()
              ),
            },
            answerCollectionEntry: {
              findMany: vi.fn(async () =>
                answerCollections.flatMap((collection) =>
                  collection.entries.map((entry) => ({
                    ...entry,
                    collectionId: collection.id,
                  }))
                )
              ),
            },
          }),
        } as any,
      }
    }

    const maximum = createExportFixture(50)
    const maximumExport = await createElementExportPackage(
      { elementIds: maximum.elementIds },
      maximum.ctx
    )
    expect(() =>
      validateElementImportPackageBuffer(maximumExport.buffer)
    ).not.toThrow()
    await expect(
      getElementExportPackagePreview(
        { elementIds: maximum.elementIds },
        maximum.ctx
      )
    ).resolves.toMatchObject({ errors: [] })

    const overLimit = createExportFixture(51)
    await expect(
      createElementExportPackage(
        { elementIds: overLimit.elementIds },
        overLimit.ctx
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
    })
    await expect(
      getElementExportPackagePreview(
        { elementIds: overLimit.elementIds },
        overLimit.ctx
      )
    ).resolves.toMatchObject({
      elements: [],
      errors: [ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT],
    })
  })

  it('rejects oversized legacy relation counts before materializing relation rows', async () => {
    const baseElement = {
      id: 1,
      name: 'Bounded legacy selection',
      content: 'Selection content',
      options: { hasSampleSolution: false, numberOfInputs: 1 },
      type: ElementType.SELECTION,
      pointsMultiplier: 1,
      explanation: null,
      version: 1,
      status: ElementStatus.READY,
      answerCollectionId: 1,
      answerCollectionItems: [],
      basePoints: true,
    }
    const itemCountFindMany = vi.fn(async () => [
      {
        ...baseElement,
        _count: { answerCollectionItems: 5_001 },
      },
    ])
    const itemCountCtx = {
      user: importExportTestUser('owner-id'),
      prisma: withMockExportSnapshotTransactions({
        element: {
          findMany: itemCountFindMany,
        },
      }),
    } as any

    await expect(
      createElementExportPackage({ elementIds: [1] }, itemCountCtx)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
    })
    expect(itemCountFindMany).toHaveBeenCalledTimes(1)

    const collectionEntryFindMany = vi.fn()
    const collectionCountCtx = {
      user: importExportTestUser('owner-id'),
      prisma: withMockExportSnapshotTransactions({
        element: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              {
                ...baseElement,
                _count: { answerCollectionItems: 0 },
              },
            ])
            .mockResolvedValueOnce([
              { ...baseElement, answerCollectionItems: [] },
            ]),
        },
        answerCollection: {
          findMany: vi.fn(async () => [
            {
              id: 1,
              name: 'Oversized legacy collection',
              description: '',
              version: 1,
              _count: { entries: 2_001 },
            },
          ]),
        },
        answerCollectionEntry: { findMany: collectionEntryFindMany },
      }),
    } as any

    await expect(
      createElementExportPackage({ elementIds: [1] }, collectionCountCtx)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
    })
    expect(collectionEntryFindMany).not.toHaveBeenCalled()
  })

  it('rechecks linked collection authorization between bounded count and full loading', async () => {
    const collection = {
      id: 1,
      name: 'Permission-race collection',
      description: '',
      version: 1,
      _count: { entries: 1 },
    }
    const entryFindMany = vi.fn(async (_args: any) => [
      { id: 11, value: 'Entry', collectionId: collection.id },
    ])
    const answerCollectionFindMany = vi
      .fn()
      .mockResolvedValueOnce([collection])
      .mockResolvedValueOnce([])
    const element = {
      id: 1,
      name: 'Permission-race selection',
      content: 'Selection content',
      options: { hasSampleSolution: true, numberOfInputs: 1 },
      type: ElementType.SELECTION,
      pointsMultiplier: 1,
      explanation: null,
      version: 1,
      status: ElementStatus.READY,
      answerCollectionId: collection.id,
      answerCollectionItems: [{ id: 11, value: 'Entry' }],
      basePoints: true,
    }
    const ctx = {
      user: importExportTestUser('owner-id'),
      prisma: withMockExportSnapshotTransactions({
        element: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              {
                ...element,
                _count: { answerCollectionItems: 1 },
              },
            ])
            .mockResolvedValueOnce([
              {
                ...element,
              },
            ]),
        },
        answerCollection: { findMany: answerCollectionFindMany },
        answerCollectionEntry: { findMany: entryFindMany },
      }),
    } as any

    await expect(
      createElementExportPackage({ elementIds: [element.id] }, ctx)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.ANSWER_COLLECTION_EXPORT_PERMISSION,
    })
    expect(entryFindMany).not.toHaveBeenCalled()
    expect(answerCollectionFindMany).toHaveBeenCalledTimes(2)
  })

  it('never previews a serialized package as portable when final export exceeds the byte cap', async () => {
    function createLargeExportFixture(count: number, contentBytes: number) {
      const content = 'x'.repeat(contentBytes)
      const elements = Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        name: `Large element ${index + 1}`,
        content,
        options: {
          displayMode: 'LIST',
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
          choices: [
            { ix: 0, value: 'A' },
            { ix: 1, value: 'B' },
          ],
        },
        type: ElementType.SC,
        pointsMultiplier: 1,
        explanation: content,
        version: 1,
        status: ElementStatus.READY,
        answerCollectionId: null,
        answerCollectionItems: [],
        basePoints: true,
      }))
      return {
        elementIds: elements.map((element) => element.id),
        ctx: {
          user: importExportTestUser('owner-id'),
          redisExec: createAvailableImportExportRedis(),
          prisma: withMockExportSnapshotTransactions({
            element: {
              findMany: vi.fn(async ({ where }) =>
                elements.filter((element) => where.id.in.includes(element.id))
              ),
            },
          }),
        } as any,
      }
    }

    const belowLimit = createLargeExportFixture(25, 200_000)
    await expect(
      getElementExportPackagePreview(
        { elementIds: belowLimit.elementIds },
        belowLimit.ctx
      )
    ).resolves.toMatchObject({ errors: [] })
    const exported = await createElementExportPackage(
      { elementIds: belowLimit.elementIds },
      belowLimit.ctx
    )
    expect(exported.buffer.length).toBeLessThanOrEqual(
      MAX_IMPORT_EXPORT_PACKAGE_BYTES
    )

    const aboveLimit = createLargeExportFixture(27, 200_000)
    await expect(
      getElementExportPackagePreview(
        { elementIds: aboveLimit.elementIds },
        aboveLimit.ctx
      )
    ).resolves.toMatchObject({
      errors: [ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE],
    })
  })

  it('rejects stale type-inapplicable DB relations in preview and final export', async () => {
    const staleEntry = { id: 91, value: 'Stale entry', collectionId: 9 }
    const staleElement = {
      id: 1,
      name: 'Legacy SC with stale relation',
      content: 'Otherwise portable content',
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: 'Correct', correct: true },
          { ix: 1, value: 'Distractor', correct: false },
        ],
      },
      type: ElementType.SC,
      pointsMultiplier: 1,
      explanation: null,
      version: 1,
      status: ElementStatus.READY,
      answerCollectionId: 9,
      answerCollectionItems: [staleEntry],
      basePoints: true,
    }
    const findCollections = vi.fn(async () => [
      {
        id: 9,
        name: 'Stale pool',
        description: '',
        version: 1,
        entries: [staleEntry],
      },
    ])
    const ctx = {
      user: importExportTestUser('owner-id'),
      redisExec: createAvailableImportExportRedis(),
      prisma: withMockExportSnapshotTransactions({
        element: { findMany: vi.fn(async () => [staleElement]) },
        answerCollection: { findMany: findCollections },
      }),
    } as any

    await expect(
      getElementExportPackagePreview({ elementIds: [1] }, ctx)
    ).resolves.toMatchObject({
      elements: [],
      answerCollections: [],
      errors: [ImportExportErrorCode.ELEMENT_NOT_PORTABLE],
    })
    await expect(
      createElementExportPackage({ elementIds: [1] }, ctx)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE,
    })
    expect(findCollections).not.toHaveBeenCalled()
  })

  it('does not misclassify unexpected export-adapter failures as nonportable data', async () => {
    const sensitiveMessage = 'unexpected export adapter internals'
    const unexpectedError = new Error(sensitiveMessage)
    const options = new Proxy(
      {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: 'Correct', correct: true },
          { ix: 1, value: 'Distractor', correct: false },
        ],
      },
      {
        ownKeys() {
          throw unexpectedError
        },
      }
    )
    const ctx = {
      user: importExportTestUser('owner-id'),
      redisExec: createAvailableImportExportRedis(),
      prisma: withMockExportSnapshotTransactions({
        element: {
          findMany: vi.fn(async () => [
            {
              id: 1,
              name: 'Adapter failure source',
              content: 'Portable content',
              options,
              type: ElementType.SC,
              pointsMultiplier: 1,
              explanation: null,
              version: 1,
              status: ElementStatus.READY,
              answerCollectionId: null,
              answerCollectionItems: [],
              basePoints: true,
            },
          ]),
        },
      }),
    } as any

    await expect(
      createElementExportPackage({ elementIds: [1] }, ctx)
    ).rejects.toBe(unexpectedError)
    await expectPublicImportExportError(
      getElementExportPackagePreview({ elementIds: [1] }, ctx),
      ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
      sensitiveMessage
    )
  })
})
