import { randomUUID } from 'node:crypto'
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
  ] as const)(
    'rejects %s validation/import before artifact download or receipt pinning',
    async (kind, code) => {
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

      const { importElementPackage, validateElementImportPackage } =
        await import('../src/services/elementImportExport.js')
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
    }
  )

  it.each([
    ['exceeded', ImportExportErrorCode.RATE_LIMITED],
    ['unavailable', ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE],
  ] as const)(
    'rejects %s preview limits before concurrency or database work',
    async (kind, code) => {
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
    }
  )
})
