import { ElementImportReceiptState } from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { createElementImportToken } from '../src/lib/elementImportToken.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'

const ORIGINAL_SECRET = process.env.IMPORT_EXPORT_TOKEN_SECRET

describe('public import rate-limit ordering', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.IMPORT_EXPORT_TOKEN_SECRET =
      'rate-limit-ordering-test-secret-with-sufficient-entropy'
  })

  afterEach(() => {
    vi.doUnmock('../src/services/importExportAuthorization.js')
    vi.doUnmock('../src/services/importExportConcurrency.js')
    vi.doUnmock('../src/services/importExportPersistence.js')
    vi.doUnmock('../src/services/importExportRateLimit.js')
    vi.doUnmock('../src/services/packageStorage.js')
    vi.restoreAllMocks()
    vi.resetModules()
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.IMPORT_EXPORT_TOKEN_SECRET
    } else {
      process.env.IMPORT_EXPORT_TOKEN_SECRET = ORIGINAL_SECRET
    }
  })

  it.each([
    ['exceeded', ImportExportErrorCode.RATE_LIMITED],
    ['unavailable', ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE],
  ] as const)('rejects %s validation/import before artifact download or receipt pinning', async (kind, code) => {
    let rateLimitError: Error
    const assertRateLimit = vi.fn(async () => {
      throw rateLimitError
    })
    const findReceipt = vi.fn(async () => null)
    const pinReceipt = vi.fn()
    const downloadPackage = vi.fn()

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportPersistence.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportPersistence.js')
      >('../src/services/importExportPersistence.js')),
      findElementImportReceiptByJti: findReceipt,
      pinReadyImportArtifactAndCreateReceipt: pinReceipt,
    }))
    vi.doMock('../src/services/importExportRateLimit.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportRateLimit.js')
      >('../src/services/importExportRateLimit.js')),
      assertImportExportRateLimit: assertRateLimit,
    }))
    vi.doMock('../src/services/packageStorage.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/packageStorage.js')
      >('../src/services/packageStorage.js')),
      downloadPreparedElementImportPackage: downloadPackage,
    }))

    const { importElementPackage, validateElementImportPackage } = await import(
      '../src/services/elementImportExport.js'
    )
    const { ImportExportRateLimitError } = await import(
      '../src/services/importExportRateLimit.js'
    )
    rateLimitError = new ImportExportRateLimitError(kind)
    const userId = randomUUID()
    const artifactId = randomUUID()
    const importToken = createElementImportToken({
      artifactId,
      packageHash: 'a'.repeat(64),
      userId,
      expiresAt: Date.now() + 60_000,
      jti: randomUUID(),
    })
    const ctx = {
      user: { sub: userId },
      prisma: {},
      redisExec: {},
    } as any

    await expect(
      validateElementImportPackage({ artifactId }, ctx)
    ).resolves.toMatchObject({
      importToken: null,
      errors: [code],
    })
    await expect(
      importElementPackage(
        { importToken, selectedElementRefs: ['element-1'] },
        ctx
      )
    ).rejects.toMatchObject({ extensions: { code } })

    expect(findReceipt).toHaveBeenCalledTimes(1)
    expect(assertRateLimit).toHaveBeenNthCalledWith(1, ctx, 'validate')
    expect(assertRateLimit).toHaveBeenNthCalledWith(2, ctx, 'import')
    expect(downloadPackage).not.toHaveBeenCalled()
    expect(pinReceipt).not.toHaveBeenCalled()
  })

  it('checks the validation lease before downloading the package', async () => {
    let leaseError: Error
    const downloadPackage = vi.fn()

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportRateLimit.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportRateLimit.js')
      >('../src/services/importExportRateLimit.js')),
      assertImportExportRateLimit: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportConcurrency.js', () => ({
      withImportExportConcurrencyLease: vi.fn(
        async (_ctx, _operation, callback) =>
          callback(() => {
            throw leaseError
          })
      ),
    }))
    vi.doMock('../src/services/packageStorage.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/packageStorage.js')
      >('../src/services/packageStorage.js')),
      downloadPreparedElementImportPackage: downloadPackage,
    }))

    const { validateElementImportPackage } = await import(
      '../src/services/elementImportExport.js'
    )
    const { ImportExportRateLimitError } = await import(
      '../src/services/importExportRateLimit.js'
    )
    leaseError = new ImportExportRateLimitError('unavailable')
    const ctx = {
      user: { sub: randomUUID() },
      prisma: {},
      redisExec: {},
    } as any

    await expect(
      validateElementImportPackage({ artifactId: randomUUID() }, ctx)
    ).resolves.toMatchObject({
      importToken: null,
      errors: [ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE],
    })
    expect(downloadPackage).not.toHaveBeenCalled()
  })

  it.each([
    ['exceeded', ImportExportErrorCode.RATE_LIMITED],
    ['unavailable', ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE],
  ] as const)('rejects %s import concurrency before creating a receipt or downloading', async (kind, code) => {
    let concurrencyError: Error
    const findReceipt = vi.fn(async () => null)
    const pinReceipt = vi.fn()
    const downloadPackage = vi.fn()
    const withConcurrency = vi.fn(async () => {
      throw concurrencyError
    })

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportPersistence.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportPersistence.js')
      >('../src/services/importExportPersistence.js')),
      findElementImportReceiptByJti: findReceipt,
      pinReadyImportArtifactAndCreateReceipt: pinReceipt,
    }))
    vi.doMock('../src/services/importExportRateLimit.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportRateLimit.js')
      >('../src/services/importExportRateLimit.js')),
      assertImportExportRateLimit: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportConcurrency.js', () => ({
      withImportExportConcurrencyLease: withConcurrency,
    }))
    vi.doMock('../src/services/packageStorage.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/packageStorage.js')
      >('../src/services/packageStorage.js')),
      downloadPreparedElementImportPackage: downloadPackage,
    }))

    const { importElementPackage } = await import(
      '../src/services/elementImportExport.js'
    )
    const { ImportExportRateLimitError } = await import(
      '../src/services/importExportRateLimit.js'
    )
    concurrencyError = new ImportExportRateLimitError(kind)
    const userId = randomUUID()
    const importToken = createElementImportToken({
      artifactId: randomUUID(),
      packageHash: 'a'.repeat(64),
      userId,
      expiresAt: Date.now() + 60_000,
      jti: randomUUID(),
    })
    const ctx = {
      user: { sub: userId },
      prisma: {},
      redisExec: {},
    } as any

    await expect(
      importElementPackage(
        { importToken, selectedElementRefs: ['element-1'] },
        ctx
      )
    ).rejects.toMatchObject({ extensions: { code } })

    expect(findReceipt).toHaveBeenCalledTimes(1)
    expect(withConcurrency).toHaveBeenCalledWith(
      ctx,
      'import',
      expect.any(Function)
    )
    expect(pinReceipt).not.toHaveBeenCalled()
    expect(downloadPackage).not.toHaveBeenCalled()
  })

  it('returns a completed replay without consuming rate or concurrency capacity', async () => {
    const userId = randomUUID()
    const artifactId = randomUUID()
    const jti = randomUUID()
    const selectedElementRefs = ['element-1']
    const packageHash = 'a'.repeat(64)
    const selectionDigest = createHash('sha256')
      .update(JSON.stringify(selectedElementRefs))
      .digest('hex')
    const findReceipt = vi.fn(async () => ({
      id: randomUUID(),
      jti,
      sourceArtifactId: artifactId,
      artifactRecordId: artifactId,
      packageHash,
      selectionDigest,
      selectedElementRefs,
      state: ElementImportReceiptState.COMPLETE,
      leaseId: null,
      leaseExpiresAt: null,
      createdElementIds: [123],
      createdAnswerCollectionIds: [],
      completedAt: new Date(),
      retentionExpiresAt: new Date(Date.now() + 60_000),
      ownerId: userId,
    }))
    const assertRateLimit = vi.fn()
    const withConcurrency = vi.fn()
    const pinReceipt = vi.fn()
    const downloadPackage = vi.fn()

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportPersistence.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportPersistence.js')
      >('../src/services/importExportPersistence.js')),
      findElementImportReceiptByJti: findReceipt,
      pinReadyImportArtifactAndCreateReceipt: pinReceipt,
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
      downloadPreparedElementImportPackage: downloadPackage,
    }))

    const { importElementPackage } = await import(
      '../src/services/elementImportExport.js'
    )
    const importToken = createElementImportToken({
      artifactId,
      packageHash,
      userId,
      expiresAt: Date.now() - 1,
      jti,
    })
    const ctx = {
      user: { sub: userId },
      prisma: { importMediaStaging: { count: vi.fn(async () => 0) } },
      redisExec: {},
    } as any

    await expect(
      importElementPackage({ importToken, selectedElementRefs }, ctx)
    ).resolves.toEqual({
      importedElements: 1,
      importedAnswerCollections: 0,
      skippedElements: 0,
      warnings: [],
    })
    expect(findReceipt).toHaveBeenCalledTimes(1)
    expect(assertRateLimit).not.toHaveBeenCalled()
    expect(withConcurrency).not.toHaveBeenCalled()
    expect(pinReceipt).not.toHaveBeenCalled()
    expect(downloadPackage).not.toHaveBeenCalled()
  })

  it('rechecks and returns a replay completed while concurrency is acquired', async () => {
    const userId = randomUUID()
    const artifactId = randomUUID()
    const jti = randomUUID()
    const selectedElementRefs = ['element-1']
    const packageHash = 'a'.repeat(64)
    const selectionDigest = createHash('sha256')
      .update(JSON.stringify(selectedElementRefs))
      .digest('hex')
    const completedReceipt = {
      id: randomUUID(),
      jti,
      sourceArtifactId: artifactId,
      artifactRecordId: artifactId,
      packageHash,
      selectionDigest,
      selectedElementRefs,
      state: ElementImportReceiptState.COMPLETE,
      leaseId: null,
      leaseExpiresAt: null,
      createdElementIds: [123],
      createdAnswerCollectionIds: [],
      completedAt: new Date(),
      retentionExpiresAt: new Date(Date.now() + 60_000),
      ownerId: userId,
    }
    const findReceipt = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(completedReceipt)
    const assertRateLimit = vi.fn(async () => undefined)
    const withConcurrency = vi.fn(async (_ctx, _operation, callback) =>
      callback(() => undefined)
    )
    const pinReceipt = vi.fn()
    const downloadPackage = vi.fn()

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportPersistence.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportPersistence.js')
      >('../src/services/importExportPersistence.js')),
      findElementImportReceiptByJti: findReceipt,
      pinReadyImportArtifactAndCreateReceipt: pinReceipt,
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
      downloadPreparedElementImportPackage: downloadPackage,
    }))

    const { importElementPackage } = await import(
      '../src/services/elementImportExport.js'
    )
    const importToken = createElementImportToken({
      artifactId,
      packageHash,
      userId,
      expiresAt: Date.now() + 60_000,
      jti,
    })
    const ctx = {
      user: { sub: userId },
      prisma: { importMediaStaging: { count: vi.fn(async () => 0) } },
      redisExec: {},
    } as any

    await expect(
      importElementPackage({ importToken, selectedElementRefs }, ctx)
    ).resolves.toMatchObject({ importedElements: 1, warnings: [] })
    expect(findReceipt).toHaveBeenCalledTimes(2)
    expect(assertRateLimit).toHaveBeenCalledWith(ctx, 'import')
    expect(withConcurrency).toHaveBeenCalledWith(
      ctx,
      'import',
      expect.any(Function)
    )
    expect(pinReceipt).not.toHaveBeenCalled()
    expect(downloadPackage).not.toHaveBeenCalled()
  })

  it.each([
    ['exceeded', ImportExportErrorCode.RATE_LIMITED],
    ['unavailable', ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE],
  ] as const)('rejects %s validation concurrency before artifact download', async (kind, code) => {
    let concurrencyError: Error
    const withConcurrency = vi.fn(async () => {
      throw concurrencyError
    })
    const downloadPackage = vi.fn()

    vi.doMock('../src/services/importExportAuthorization.js', () => ({
      assertCanUseElementImportExport: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportRateLimit.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/importExportRateLimit.js')
      >('../src/services/importExportRateLimit.js')),
      assertImportExportRateLimit: vi.fn(async () => undefined),
    }))
    vi.doMock('../src/services/importExportConcurrency.js', () => ({
      withImportExportConcurrencyLease: withConcurrency,
    }))
    vi.doMock('../src/services/packageStorage.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/packageStorage.js')
      >('../src/services/packageStorage.js')),
      downloadPreparedElementImportPackage: downloadPackage,
    }))

    const { validateElementImportPackage } = await import(
      '../src/services/elementImportExport.js'
    )
    const { ImportExportRateLimitError } = await import(
      '../src/services/importExportRateLimit.js'
    )
    concurrencyError = new ImportExportRateLimitError(kind)
    const ctx = {
      user: { sub: randomUUID() },
      prisma: {},
      redisExec: {},
    } as any

    await expect(
      validateElementImportPackage({ artifactId: randomUUID() }, ctx)
    ).resolves.toMatchObject({
      importToken: null,
      errors: [code],
    })
    expect(withConcurrency).toHaveBeenCalledWith(
      ctx,
      'validate',
      expect.any(Function)
    )
    expect(downloadPackage).not.toHaveBeenCalled()
  })

  it.each([
    ['exceeded', ImportExportErrorCode.RATE_LIMITED],
    ['unavailable', ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE],
  ] as const)('rejects %s preview limits before concurrency or database work', async (kind, code) => {
    let rateLimitError: Error
    const assertRateLimit = vi.fn(async () => {
      throw rateLimitError
    })
    const withConcurrency = vi.fn()
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

    const { getElementExportPackagePreview } = await import(
      '../src/services/elementImportExport.js'
    )
    const { ImportExportRateLimitError } = await import(
      '../src/services/importExportRateLimit.js'
    )
    rateLimitError = new ImportExportRateLimitError(kind)
    const ctx = {
      user: { sub: randomUUID() },
      prisma: { element: { findMany } },
    } as any

    await expect(
      getElementExportPackagePreview({ elementIds: [1] }, ctx)
    ).rejects.toMatchObject({ extensions: { code } })

    expect(assertRateLimit).toHaveBeenCalledWith(ctx, 'preview')
    expect(withConcurrency).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })
})
