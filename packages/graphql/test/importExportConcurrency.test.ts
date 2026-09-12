import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { withImportExportConcurrencyLease } from '../src/services/importExportConcurrency.js'

describe('import/export concurrency leases', () => {
  const previousPreviewLimit =
    process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY
  const previousPreviewGlobalLimit =
    process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY
  const previousValidateLimit =
    process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY
  const previousValidateGlobalLimit =
    process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY
  const previousImportLimit =
    process.env.IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY
  const previousImportGlobalLimit =
    process.env.IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY
  const previousUploadLimit =
    process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY
  const previousUploadGlobalLimit =
    process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY
  const previousTtl = process.env.IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS

  beforeEach(() => {
    process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY = '2'
    process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY = '8'
    process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY = '2'
    process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY = '8'
    process.env.IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY = '1'
    process.env.IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY = '4'
    process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY = '1'
    process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY = '4'
    process.env.IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS = '60000'
  })

  afterEach(() => {
    if (previousPreviewLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_CONCURRENCY =
        previousPreviewLimit
    }
    if (previousTtl === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS = previousTtl
    }
    if (previousPreviewGlobalLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_PREVIEW_GLOBAL_CONCURRENCY =
        previousPreviewGlobalLimit
    }
    if (previousValidateLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY =
        previousValidateLimit
    }
    if (previousValidateGlobalLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY =
        previousValidateGlobalLimit
    }
    if (previousImportLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_IMPORT_CONCURRENCY = previousImportLimit
    }
    if (previousImportGlobalLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_IMPORT_GLOBAL_CONCURRENCY =
        previousImportGlobalLimit
    }
    if (previousUploadLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_CONCURRENCY = previousUploadLimit
    }
    if (previousUploadGlobalLimit === undefined) {
      delete process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY
    } else {
      process.env.IMPORT_EXPORT_PACKAGE_UPLOAD_GLOBAL_CONCURRENCY =
        previousUploadGlobalLimit
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('acquires and releases a user-scoped expiring lease', async () => {
    const evalRedis = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    const callback = vi.fn(async () => 'completed')
    const ctx = {
      user: { sub: '11111111-1111-4111-8111-111111111111' },
      redisExec: { eval: evalRedis },
    } as any

    await expect(
      withImportExportConcurrencyLease(ctx, 'preview', callback)
    ).resolves.toBe('completed')

    expect(callback).toHaveBeenCalledTimes(1)
    expect(evalRedis).toHaveBeenCalledTimes(2)
    expect(evalRedis.mock.calls[0]).toEqual([
      expect.stringContaining('ZREMRANGEBYSCORE'),
      2,
      `concurrency:{import-export-package}:preview:user:${ctx.user.sub}`,
      'concurrency:{import-export-package}:preview:global',
      expect.any(Number),
      60_000,
      2,
      8,
      expect.any(String),
    ])
    expect(evalRedis.mock.calls[1]).toEqual([
      expect.stringContaining("redis.call('ZREM'"),
      2,
      `concurrency:{import-export-package}:preview:user:${ctx.user.sub}`,
      'concurrency:{import-export-package}:preview:global',
      evalRedis.mock.calls[0]![8],
    ])
  })

  it('fails closed without starting work when the concurrency limit is full', async () => {
    const callback = vi.fn()
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: vi.fn(async () => 0) },
    } as any

    await expect(
      withImportExportConcurrencyLease(ctx, 'preview', callback)
    ).rejects.toMatchObject({ code: ImportExportErrorCode.RATE_LIMITED })
    expect(callback).not.toHaveBeenCalled()
    expect(ctx.redisExec.eval).toHaveBeenCalledTimes(1)
  })

  it('uses dedicated per-user and global limits for validation', async () => {
    process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_CONCURRENCY = '3'
    process.env.IMPORT_EXPORT_PACKAGE_VALIDATE_GLOBAL_CONCURRENCY = '5'
    const evalRedis = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: evalRedis },
    } as any

    await expect(
      withImportExportConcurrencyLease(ctx, 'validate', async () => 'validated')
    ).resolves.toBe('validated')
    expect(evalRedis.mock.calls[0]).toEqual([
      expect.stringContaining('ZREMRANGEBYSCORE'),
      2,
      'concurrency:{import-export-package}:validate:user:owner',
      'concurrency:{import-export-package}:validate:global',
      expect.any(Number),
      60_000,
      3,
      5,
      expect.any(String),
    ])
  })

  it('uses independent one-per-user and four-global import defaults', async () => {
    const evalRedis = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: evalRedis },
    } as any

    await expect(
      withImportExportConcurrencyLease(ctx, 'import', async () => 'imported')
    ).resolves.toBe('imported')
    expect(evalRedis.mock.calls[0]).toEqual([
      expect.stringContaining('ZREMRANGEBYSCORE'),
      2,
      'concurrency:{import-export-package}:import:user:owner',
      'concurrency:{import-export-package}:import:global',
      expect.any(Number),
      60_000,
      1,
      4,
      expect.any(String),
    ])
  })

  it('uses memory-safe one-per-user and four-global upload defaults', async () => {
    const evalRedis = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: evalRedis },
    } as any

    await expect(
      withImportExportConcurrencyLease(ctx, 'upload', async () => 'uploaded')
    ).resolves.toBe('uploaded')
    expect(evalRedis.mock.calls[0]).toEqual([
      expect.stringContaining('ZREMRANGEBYSCORE'),
      2,
      'concurrency:{import-export-package}:upload:user:owner',
      'concurrency:{import-export-package}:upload:global',
      expect.any(Number),
      60_000,
      1,
      4,
      expect.any(String),
    ])
  })

  it('fails closed distinctly when Redis cannot acquire a lease', async () => {
    const callback = vi.fn()
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: vi.fn(async () => Promise.reject(new Error('down'))) },
    } as any

    await expect(
      withImportExportConcurrencyLease(ctx, 'export', callback)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE,
    })
    expect(callback).not.toHaveBeenCalled()
    expect(consoleInfo).toHaveBeenCalledWith(
      '[ImportExportTelemetry]',
      expect.stringContaining('"code":"CONCURRENCY_EXPORT_ACQUIRE_FAILED"')
    )
  })

  it('releases after callback failure and does not mask success on release failure', async () => {
    const callbackError = new Error('export failed')
    const failingCallbackRedis = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
    const failingCtx = {
      user: { sub: 'owner' },
      redisExec: { eval: failingCallbackRedis },
    } as any

    await expect(
      withImportExportConcurrencyLease(failingCtx, 'export', async () => {
        throw callbackError
      })
    ).rejects.toBe(callbackError)
    expect(failingCallbackRedis).toHaveBeenCalledTimes(2)

    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    const releaseFailureRedis = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('release failed'))
    const successfulCtx = {
      user: { sub: 'owner' },
      redisExec: { eval: releaseFailureRedis },
    } as any
    await expect(
      withImportExportConcurrencyLease(
        successfulCtx,
        'export',
        async () => 'completed'
      )
    ).resolves.toBe('completed')
    expect(consoleInfo).toHaveBeenCalledWith(
      '[ImportExportTelemetry]',
      expect.stringContaining('"code":"CONCURRENCY_EXPORT_RELEASE_FAILED"')
    )
  })

  it('renews both lease members while work exceeds the initial heartbeat interval', async () => {
    vi.useFakeTimers()
    process.env.IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS = '3000'
    let continueWork!: () => void
    const callback = vi.fn(
      async (assertLease: () => void) =>
        await new Promise<string>((resolve, reject) => {
          continueWork = () => {
            try {
              assertLease()
              resolve('completed')
            } catch (error) {
              reject(error)
            }
          }
        })
    )
    let renewalCount = 0
    const evalRedis = vi.fn((script: string) => {
      if (!script.includes('ZSCORE')) return Promise.resolve(1)

      renewalCount += 1
      if (renewalCount === 1) return Promise.resolve(1)
      return new Promise<number>(() => {})
    })
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: evalRedis },
    } as any

    const operation = withImportExportConcurrencyLease(ctx, 'preview', callback)
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_001)

    expect(evalRedis).toHaveBeenCalledWith(
      expect.stringContaining('ZSCORE'),
      2,
      'concurrency:{import-export-package}:preview:user:owner',
      'concurrency:{import-export-package}:preview:global',
      expect.any(String),
      expect.any(Number),
      3_000
    )

    // The successful owner-checked renewal extends the local deadline beyond
    // the original 3-second acquisition deadline. A later stalled renewal
    // cannot erase that confirmed extension.
    await vi.advanceTimersByTimeAsync(2_498)
    continueWork()
    await expect(operation).resolves.toBe('completed')
    expect(evalRedis).toHaveBeenCalledTimes(4)
  })

  it('fences work once the local deadline passes while renewal is stalled', async () => {
    vi.useFakeTimers()
    process.env.IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS = '3000'
    let continueWork!: () => void
    const evalRedis = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockImplementationOnce(() => new Promise<number>(() => {}))
      .mockResolvedValueOnce(1)
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: evalRedis },
    } as any
    const operation = withImportExportConcurrencyLease(
      ctx,
      'export',
      async (assertLease) =>
        await new Promise<void>((resolve, reject) => {
          continueWork = () => {
            try {
              assertLease()
              resolve()
            } catch (error) {
              reject(error)
            }
          }
        })
    )

    await vi.advanceTimersByTimeAsync(1_001)
    expect(evalRedis).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1_999)
    continueWork()

    await expect(operation).rejects.toMatchObject({
      code: ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE,
    })
    expect(evalRedis).toHaveBeenCalledTimes(3)
  })

  it('fences work before side effects when heartbeat ownership is lost', async () => {
    vi.useFakeTimers()
    process.env.IMPORT_EXPORT_PACKAGE_CONCURRENCY_LEASE_TTL_MS = '3000'
    let continueWork!: () => void
    const evalRedis = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
    const ctx = {
      user: { sub: 'owner' },
      redisExec: { eval: evalRedis },
    } as any
    const operation = withImportExportConcurrencyLease(
      ctx,
      'export',
      async (assertLease) =>
        await new Promise<void>((resolve, reject) => {
          continueWork = () => {
            try {
              assertLease()
              resolve()
            } catch (error) {
              reject(error)
            }
          }
        })
    )
    await vi.advanceTimersByTimeAsync(1_001)
    continueWork()

    await expect(operation).rejects.toMatchObject({
      code: ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE,
    })
    expect(evalRedis).toHaveBeenCalledTimes(3)
  })
})
