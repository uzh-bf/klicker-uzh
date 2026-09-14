import {
  ElementStatus,
  ElementType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'

describe('public export containment ordering', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('../src/services/importExportAuthorization.js')
    vi.doUnmock('../src/services/importExportConcurrency.js')
    vi.doUnmock('../src/services/importExportRateLimit.js')
    vi.doUnmock('../src/services/elementExportSnapshot.js')
    vi.doUnmock('../src/services/packageStorage.js')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('reserves quota before source work, releases failed builds, and passes the reservation to storage', async () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    const reservation = {
      artifactId: '11111111-1111-4111-8111-111111111111',
      target: {
        storageContainer: 'packages',
        storageBlob: 'exports/owner/artifact.zip',
      },
      reservedBytes: 10 * 1024 * 1024,
    }
    const reserveExport = vi.fn()
    const discardExport = vi.fn(async () => undefined)
    const uploadExport = vi.fn(
      async ({
        publishGuard,
      }: {
        publishGuard: (prisma: unknown) => Promise<void>
      }) => {
        await publishGuard({} as never)
        return {
          artifactId: reservation.artifactId,
          downloadLink: 'https://example.invalid/download',
          filename: 'export.zip',
          expiresAt: new Date(Date.now() + 60_000),
        }
      }
    )
    const assertRateLimit = vi.fn(async () => undefined)
    const withConcurrency = vi.fn(async (_ctx, _operation, callback) =>
      callback(() => undefined)
    )
    const loadSnapshot = vi.fn()
    const assertPublishable = vi.fn(async () => undefined)

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportRateLimit.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportRateLimit.js')
      >('../src/services/importExportRateLimit.js')),
      assertImportExportRateLimit: assertRateLimit,
    }))
    vi.doMock('../src/services/importExportConcurrency.js', () => ({
      withImportExportConcurrencyLease: withConcurrency,
    }))
    vi.doMock('../src/services/elementExportSnapshot.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/elementExportSnapshot.js')
      >('../src/services/elementExportSnapshot.js')),
      loadElementExportSnapshot: loadSnapshot,
      assertElementExportSnapshotPublishable: assertPublishable,
    }))
    vi.doMock('../src/services/packageStorage.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/packageStorage.js')
      >('../src/services/packageStorage.js')),
      reserveElementExportPackageArtifact: reserveExport,
      discardElementExportPackageReservation: discardExport,
      uploadElementExportPackage: uploadExport,
    }))

    const { getElementExportPackageLink } = await import(
      '../src/services/elementImportExport.js'
    )
    const { ImportExportDomainError } = await import(
      '../src/lib/importExportErrors.js'
    )
    const ctx = {
      user: { sub: 'owner' },
      prisma: {},
    } as any
    const toSnapshot = (elements: Array<Record<string, unknown>>) => ({
      elements: elements.map((element) => ({
        ...element,
        updatedAt: new Date(0),
        exportPermission: PermissionLevel.OWNER,
      })),
      answerCollections: [],
      revision: {
        token: '0'.repeat(64),
        elementIds: elements.map(({ id }) => Number(id)),
        answerCollectionIds: [],
      },
    })

    reserveExport.mockRejectedValueOnce(
      new ImportExportDomainError(ImportExportErrorCode.ARTIFACT_QUOTA_EXCEEDED)
    )
    await expect(
      getElementExportPackageLink({ elementIds: [1] }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: ImportExportErrorCode.ARTIFACT_QUOTA_EXCEEDED },
    })
    expect(loadSnapshot).not.toHaveBeenCalled()
    expect(uploadExport).not.toHaveBeenCalled()
    expect(discardExport).not.toHaveBeenCalled()

    reserveExport.mockResolvedValueOnce(reservation)
    loadSnapshot.mockResolvedValueOnce(
      toSnapshot([
        {
          id: 1,
          name: 'Oversized legacy source',
          content: 'x'.repeat(200_001),
          options: {},
          type: ElementType.CONTENT,
          pointsMultiplier: 1,
          explanation: null,
          version: 1,
          status: ElementStatus.READY,
          answerCollectionId: null,
          answerCollectionItems: [],
          basePoints: false,
        },
      ])
    )
    await expect(
      getElementExportPackageLink({ elementIds: [1] }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE },
    })
    expect(discardExport).toHaveBeenCalledWith(reservation, ctx)
    expect(uploadExport).not.toHaveBeenCalled()

    const elements = Array.from({ length: 41 }, (_, index) => ({
      id: index + 1,
      name: `Portable export ${index + 1}`,
      content: 'Portable question',
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
      explanation: null,
      version: 1,
      status: ElementStatus.READY,
      answerCollectionId: null,
      answerCollectionItems: [],
      basePoints: true,
    }))
    reserveExport.mockResolvedValueOnce(reservation)
    loadSnapshot.mockResolvedValueOnce(toSnapshot(elements))
    await expect(
      getElementExportPackageLink(
        { elementIds: elements.map((element) => element.id) },
        ctx
      )
    ).resolves.toMatchObject({ artifactId: reservation.artifactId })
    expect(uploadExport).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: expect.any(Buffer),
        publishGuard: expect.any(Function),
        reservation,
      }),
      ctx
    )
    expect(assertPublishable).toHaveBeenCalledWith(
      {
        token: '0'.repeat(64),
        elementIds: elements.map((element) => element.id),
        answerCollectionIds: [],
      },
      { ...ctx, prisma: {} }
    )
    expect(discardExport).toHaveBeenCalledTimes(1)
    expect(loadSnapshot).toHaveBeenLastCalledWith(
      elements.map((element) => element.id),
      ctx
    )
    expect(assertRateLimit).toHaveBeenCalledTimes(3)
    expect(withConcurrency).toHaveBeenCalledTimes(3)
    const requestMetrics = consoleInfo.mock.calls
      .filter(([label]) => label === '[ImportExportTelemetry]')
      .map(([, payload]) => JSON.parse(String(payload)))
      .filter((payload) => payload.operation === 'export')
    expect(requestMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'import_export_operation',
          operation: 'export',
          outcome: 'success',
          metrics: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
          correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
        expect.objectContaining({
          event: 'import_export_operation',
          operation: 'export',
          outcome: 'failure',
          code: ImportExportErrorCode.ARTIFACT_QUOTA_EXCEEDED,
        }),
      ])
    )
    expect(JSON.stringify(requestMetrics)).not.toContain('Portable question')
  })

  it.each([
    ['exceeded', ImportExportErrorCode.RATE_LIMITED],
    ['unavailable', ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE],
  ] as const)('rejects %s export limits before concurrency, reservation, or source work', async (kind, code) => {
    let rateLimitError: Error
    const assertRateLimit = vi.fn(async () => {
      throw rateLimitError
    })
    const withConcurrency = vi.fn()
    const reserveExport = vi.fn()
    const findMany = vi.fn()

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportRateLimit.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportRateLimit.js')
      >('../src/services/importExportRateLimit.js')),
      assertImportExportRateLimit: assertRateLimit,
    }))
    vi.doMock('../src/services/importExportConcurrency.js', () => ({
      withImportExportConcurrencyLease: withConcurrency,
    }))
    vi.doMock('../src/services/packageStorage.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/packageStorage.js')
      >('../src/services/packageStorage.js')),
      reserveElementExportPackageArtifact: reserveExport,
    }))

    const { getElementExportPackageLink } = await import(
      '../src/services/elementImportExport.js'
    )
    const { ImportExportRateLimitError } = await import(
      '../src/services/importExportRateLimit.js'
    )
    rateLimitError = new ImportExportRateLimitError(kind)
    const ctx = {
      user: { sub: 'owner' },
      prisma: { element: { findMany } },
    } as any

    await expect(
      getElementExportPackageLink({ elementIds: [1] }, ctx)
    ).rejects.toMatchObject({ extensions: { code } })
    expect(assertRateLimit).toHaveBeenCalledWith(ctx, 'export')
    expect(withConcurrency).not.toHaveBeenCalled()
    expect(reserveExport).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })
})
