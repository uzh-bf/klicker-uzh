import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import { getImportExportRuntimeConfig } from '../lib/importExportRuntimeConfig.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import { ImportExportRateLimitError } from './importExportRateLimit.js'

export type ImportExportConcurrentOperation =
  | 'preview'
  | 'upload'
  | 'validate'
  | 'import'
  | 'export'

const ACQUIRE_CONCURRENCY_LEASE_SCRIPT = `
local userKey = KEYS[1]
local globalKey = KEYS[2]
local now = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])
local userLimit = tonumber(ARGV[3])
local globalLimit = tonumber(ARGV[4])
local member = ARGV[5]
redis.call('ZREMRANGEBYSCORE', userKey, 0, now)
redis.call('ZREMRANGEBYSCORE', globalKey, 0, now)
local userCount = redis.call('ZCARD', userKey)
local globalCount = redis.call('ZCARD', globalKey)
if userCount >= userLimit or globalCount >= globalLimit then
  redis.call('PEXPIRE', userKey, ttlMs)
  redis.call('PEXPIRE', globalKey, ttlMs)
  return 0
end
redis.call('ZADD', userKey, now + ttlMs, member)
redis.call('ZADD', globalKey, now + ttlMs, member)
redis.call('PEXPIRE', userKey, ttlMs)
redis.call('PEXPIRE', globalKey, ttlMs)
return 1
`

const RELEASE_CONCURRENCY_LEASE_SCRIPT = `
local member = ARGV[1]
redis.call('ZREM', KEYS[1], member)
redis.call('ZREM', KEYS[2], member)
return 1
`

const RENEW_CONCURRENCY_LEASE_SCRIPT = `
local member = ARGV[1]
local expiresAt = tonumber(ARGV[2])
local ttlMs = tonumber(ARGV[3])
if not redis.call('ZSCORE', KEYS[1], member) or not redis.call('ZSCORE', KEYS[2], member) then
  return 0
end
redis.call('ZADD', KEYS[1], 'XX', expiresAt, member)
redis.call('ZADD', KEYS[2], 'XX', expiresAt, member)
redis.call('PEXPIRE', KEYS[1], ttlMs)
redis.call('PEXPIRE', KEYS[2], ttlMs)
return 1
`

function getConcurrencyConfig(operation: ImportExportConcurrentOperation) {
  const config = getImportExportRuntimeConfig()
  switch (operation) {
    case 'preview':
      return {
        limit: config.concurrency.previewPerUser,
        globalLimit: config.concurrency.previewGlobal,
        ttlMs: config.concurrency.leaseTtlMs,
      }
    case 'upload':
      return {
        limit: config.concurrency.uploadPerUser,
        globalLimit: config.concurrency.uploadGlobal,
        ttlMs: config.concurrency.leaseTtlMs,
      }
    case 'validate':
      return {
        limit: config.concurrency.validatePerUser,
        globalLimit: config.concurrency.validateGlobal,
        ttlMs: config.concurrency.leaseTtlMs,
      }
    case 'import':
      return {
        limit: config.concurrency.importPerUser,
        globalLimit: config.concurrency.importGlobal,
        ttlMs: config.concurrency.leaseTtlMs,
      }
    case 'export':
      return {
        limit: config.concurrency.exportPerUser,
        globalLimit: config.concurrency.exportGlobal,
        ttlMs: config.concurrency.leaseTtlMs,
      }
  }
}

export async function withImportExportConcurrencyLease<T>(
  ctx: Pick<ContextWithUser, 'redisExec' | 'user'>,
  operation: ImportExportConcurrentOperation,
  callback: (assertLease: () => void) => Promise<T>
) {
  const { limit, globalLimit, ttlMs } = getConcurrencyConfig(operation)
  const member = randomUUID()
  const userKey = `concurrency:{import-export-package}:${operation}:user:${ctx.user.sub}`
  const globalKey = `concurrency:{import-export-package}:${operation}:global`
  const acquiredAt = Date.now()

  try {
    const acquired = Number(
      await ctx.redisExec.eval(
        ACQUIRE_CONCURRENCY_LEASE_SCRIPT,
        2,
        userKey,
        globalKey,
        acquiredAt,
        ttlMs,
        limit,
        globalLimit,
        member
      )
    )
    if (acquired !== 0 && acquired !== 1) {
      throw new Error('Unexpected import/export concurrency response.')
    }
    if (acquired === 0) {
      throw new ImportExportRateLimitError('exceeded')
    }
  } catch (error) {
    if (error instanceof ImportExportRateLimitError) throw error
    emitImportExportTelemetry({
      operation: 'concurrency',
      outcome: 'failure',
      code: `CONCURRENCY_${operation.toUpperCase()}_ACQUIRE_FAILED`,
    })
    throw new ImportExportRateLimitError('unavailable', error)
  }

  let leaseLost = false
  let leaseDeadline = acquiredAt + ttlMs
  let renewalInFlight = false
  const renewalInterval = setInterval(
    () => {
      if (renewalInFlight || leaseLost) return
      if (Date.now() >= leaseDeadline) {
        leaseLost = true
        return
      }
      renewalInFlight = true
      const renewalExpiresAt = Date.now() + ttlMs
      void ctx.redisExec
        .eval(
          RENEW_CONCURRENCY_LEASE_SCRIPT,
          2,
          userKey,
          globalKey,
          member,
          renewalExpiresAt,
          ttlMs
        )
        .then((renewed) => {
          if (Number(renewed) !== 1) {
            leaseLost = true
            return
          }

          leaseDeadline = Math.max(leaseDeadline, renewalExpiresAt)
          if (Date.now() >= leaseDeadline) leaseLost = true
        })
        .catch(() => {
          // Retry transient renewal failures only while the last confirmed
          // lease deadline is still in the future.
          if (Date.now() >= leaseDeadline) leaseLost = true
          emitImportExportTelemetry({
            operation: 'concurrency',
            outcome: 'failure',
            code: `CONCURRENCY_${operation.toUpperCase()}_RENEW_FAILED`,
          })
        })
        .finally(() => {
          renewalInFlight = false
        })
    },
    Math.max(1_000, Math.floor(ttlMs / 3))
  )
  renewalInterval.unref?.()

  try {
    return await callback(() => {
      if (leaseLost || Date.now() >= leaseDeadline) {
        leaseLost = true
        throw new ImportExportRateLimitError('unavailable')
      }
    })
  } finally {
    clearInterval(renewalInterval)
    try {
      await ctx.redisExec.eval(
        RELEASE_CONCURRENCY_LEASE_SCRIPT,
        2,
        userKey,
        globalKey,
        member
      )
    } catch {
      // The lease is expiring. Cleanup failure must not turn completed work
      // into an apparent operation failure.
      emitImportExportTelemetry({
        operation: 'concurrency',
        outcome: 'failure',
        code: `CONCURRENCY_${operation.toUpperCase()}_RELEASE_FAILED`,
      })
    }
  }
}
