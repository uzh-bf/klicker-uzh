import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../lib/importExportErrors.js'
import { getImportExportRuntimeConfig } from '../lib/importExportRuntimeConfig.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'

const SLIDING_WINDOW_RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)
if count >= limit then
  redis.call('PEXPIRE', key, windowMs)
  return {0, count}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return {1, count + 1}
`

export type ImportExportRateLimitedOperation =
  | 'preview'
  | 'export'
  | 'upload'
  | 'validate'
  | 'import'

export class ImportExportRateLimitError extends ImportExportDomainError {
  constructor(
    readonly kind: 'exceeded' | 'unavailable',
    cause?: unknown
  ) {
    super(
      kind === 'exceeded'
        ? ImportExportErrorCode.RATE_LIMITED
        : ImportExportErrorCode.RATE_LIMIT_UNAVAILABLE,
      cause
    )
    this.name = 'ImportExportRateLimitError'
  }
}

export async function assertImportExportRateLimit(
  ctx: Pick<ContextWithUser, 'redisExec' | 'user'>,
  operation: ImportExportRateLimitedOperation
) {
  const config = getImportExportRuntimeConfig()
  const windowSeconds = config.rateLimitWindowSeconds
  const limit = config.rateLimits[operation]
  const windowMs = windowSeconds * 1000
  const key = `rate-limit:import-export-package:${operation}:${ctx.user.sub}`

  try {
    const rateLimitResult = await ctx.redisExec.eval(
      SLIDING_WINDOW_RATE_LIMIT_SCRIPT,
      1,
      key,
      Date.now(),
      windowMs,
      limit,
      randomUUID()
    )
    const [allowed, count] = Array.isArray(rateLimitResult)
      ? rateLimitResult.map((value) => Number(value))
      : []

    if (allowed !== 0 && allowed !== 1) {
      throw new Error('Unexpected import/export rate-limit response.')
    }

    if (allowed === 0) {
      emitImportExportTelemetry({
        operation: 'rate_limit',
        outcome: 'rejected',
        code: 'RATE_LIMITED',
        limit,
        windowSeconds,
        rateLimitCount: count ?? limit,
      })
      throw new ImportExportRateLimitError('exceeded')
    }
  } catch (error) {
    if (
      error instanceof ImportExportRateLimitError &&
      error.kind === 'exceeded'
    ) {
      throw error
    }

    emitImportExportTelemetry({
      operation: 'rate_limit',
      outcome: 'failure',
      code: `RATE_LIMIT_${operation.toUpperCase()}_UNAVAILABLE`,
      limit,
      windowSeconds,
    })
    throw new ImportExportRateLimitError('unavailable', error)
  }
}
