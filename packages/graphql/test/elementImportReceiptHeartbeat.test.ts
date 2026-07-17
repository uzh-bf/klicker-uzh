import { randomUUID } from 'node:crypto'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'

const RECEIPT_LEASE_MS = 5 * 60 * 1000

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function loadHeartbeat(renewLease: ReturnType<typeof vi.fn>) {
  vi.doMock('../src/services/importExportPersistence.js', async () => ({
    ...(await vi.importActual<
      typeof import('../src/services/importExportPersistence.js')
    >('../src/services/importExportPersistence.js')),
    renewElementImportReceiptLease: renewLease,
  }))

  return await import('../src/services/elementImportReceiptOrchestration.js')
}

describe('element import receipt lease renewal', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('../src/services/importExportPersistence.js')
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.resetModules()
  })

  it('renews only the exact live pending owner and lease identity', async () => {
    const receiptId = randomUUID()
    const ownerId = randomUUID()
    const leaseId = randomUUID()
    const now = new Date('2026-07-15T08:00:00.000Z')
    const leaseExpiresAt = new Date(now.getTime() + RECEIPT_LEASE_MS)
    const queryRaw = vi.fn(async (..._args: unknown[]) => [{ id: receiptId }])
    const { renewElementImportReceiptLease } = await import(
      '../src/services/importExportPersistence.js'
    )

    await expect(
      renewElementImportReceiptLease({
        prisma: { $queryRaw: queryRaw } as any,
        receiptId,
        ownerId,
        leaseId,
        leaseExpiresAt,
        now,
      })
    ).resolves.toBe(true)
    const [query, ...values] = queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ]
    expect(Array.from(query).join('?')).toContain('AND "ownerId" = ?::uuid')
    expect(Array.from(query).join('?')).toContain('AND "state" = \'PENDING\'')
    expect(Array.from(query).join('?')).toContain(
      'AND "leaseExpiresAt" > CURRENT_TIMESTAMP'
    )
    expect(values).toEqual([
      leaseExpiresAt,
      receiptId,
      ownerId,
      leaseId,
      leaseExpiresAt,
    ])

    queryRaw.mockResolvedValueOnce([])
    await expect(
      renewElementImportReceiptLease({
        prisma: { $queryRaw: queryRaw } as any,
        receiptId,
        ownerId,
        leaseId,
        leaseExpiresAt,
        now,
      })
    ).resolves.toBe(false)
  })

  it('renews across multiple initial TTLs and clears its timer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const renewLease = vi.fn(async () => true)
    const { withElementImportReceiptHeartbeat } =
      await loadHeartbeat(renewLease)
    const execution = {
      receiptId: randomUUID(),
      leaseId: randomUUID(),
      leaseExpiresAt: new Date(RECEIPT_LEASE_MS),
    }
    const ctx = {
      user: { sub: randomUUID() },
      prisma: {},
    } as any
    let assertLease!: () => void
    let finish!: () => void

    const operation = withElementImportReceiptHeartbeat({
      execution,
      ctx,
      callback: async (guard) =>
        await new Promise<void>((resolve) => {
          assertLease = guard.assertLease
          finish = resolve
        }),
    })
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(RECEIPT_LEASE_MS / 3 + 1)
    expect(renewLease).toHaveBeenCalledTimes(1)
    assertLease()
    await vi.advanceTimersByTimeAsync(RECEIPT_LEASE_MS / 3)
    expect(renewLease).toHaveBeenCalledTimes(2)
    assertLease()

    finish()
    await expect(operation).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('allows only one renewal request in flight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const renewal = createDeferred<boolean>()
    const renewLease = vi.fn(() => renewal.promise)
    const { withElementImportReceiptHeartbeat } =
      await loadHeartbeat(renewLease)
    let finish!: () => void

    const operation = withElementImportReceiptHeartbeat({
      execution: {
        receiptId: randomUUID(),
        leaseId: randomUUID(),
        leaseExpiresAt: new Date(RECEIPT_LEASE_MS),
      },
      ctx: { user: { sub: randomUUID() }, prisma: {} } as any,
      callback: async () =>
        await new Promise<void>((resolve) => {
          finish = resolve
        }),
    })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync((RECEIPT_LEASE_MS / 3) * 2 + 1)
    expect(renewLease).toHaveBeenCalledTimes(1)

    renewal.resolve(true)
    await vi.advanceTimersByTimeAsync(0)
    finish()
    await expect(operation).resolves.toBeUndefined()
  })

  it('fences immediately when renewal loses receipt ownership', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const renewLease = vi.fn(async () => false)
    const { withElementImportReceiptHeartbeat } =
      await loadHeartbeat(renewLease)
    let continueWork!: () => void

    const operation = withElementImportReceiptHeartbeat({
      execution: {
        receiptId: randomUUID(),
        leaseId: randomUUID(),
        leaseExpiresAt: new Date(RECEIPT_LEASE_MS),
      },
      ctx: { user: { sub: randomUUID() }, prisma: {} } as any,
      callback: async (guard) =>
        await new Promise<void>((resolve, reject) => {
          continueWork = () => {
            try {
              guard.assertLease()
              resolve()
            } catch (error) {
              reject(error)
            }
          }
        }),
    })
    await vi.advanceTimersByTimeAsync(RECEIPT_LEASE_MS / 3 + 1)
    continueWork()

    await expect(operation).rejects.toMatchObject({
      code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
    })
  })

  it('does not revive work when a delayed renewal settles after local fencing', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const renewal = createDeferred<boolean>()
    const renewLease = vi.fn(() => renewal.promise)
    const { withElementImportReceiptHeartbeat } =
      await loadHeartbeat(renewLease)
    let continueWork!: () => void

    const operation = withElementImportReceiptHeartbeat({
      execution: {
        receiptId: randomUUID(),
        leaseId: randomUUID(),
        leaseExpiresAt: new Date(RECEIPT_LEASE_MS),
      },
      ctx: { user: { sub: randomUUID() }, prisma: {} } as any,
      callback: async (guard) =>
        await new Promise<void>((resolve, reject) => {
          continueWork = () => {
            try {
              guard.assertLease()
              resolve()
            } catch (error) {
              reject(error)
            }
          }
        }),
    })
    await vi.advanceTimersByTimeAsync(RECEIPT_LEASE_MS + 1)
    continueWork()
    renewal.resolve(true)

    await expect(operation).rejects.toMatchObject({
      code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
    })
  })

  it('maps an explicit renewal failure to the fenced import error', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const renewLease = vi.fn(async () => {
      throw new Error('database unavailable')
    })
    const { withElementImportReceiptHeartbeat } =
      await loadHeartbeat(renewLease)

    await expect(
      withElementImportReceiptHeartbeat({
        execution: {
          receiptId: randomUUID(),
          leaseId: randomUUID(),
          leaseExpiresAt: new Date(RECEIPT_LEASE_MS),
        },
        ctx: { user: { sub: randomUUID() }, prisma: {} } as any,
        callback: async ({ renewNow }) => await renewNow(),
      })
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
    })
  })
})
