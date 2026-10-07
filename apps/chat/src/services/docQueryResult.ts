import { createHash } from 'node:crypto'
import { isIngestionReference } from '../lib/sources/normalizeSources'

function redactGateway(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"'\\]+/gi, (candidate) => {
    if (isIngestionReference(candidate)) {
      return `document-${createHash('sha256').update(candidate).digest('hex').slice(0, 16)}`
    }
    // Non-URL text is preserved verbatim.
    return candidate
  })
}

// MCP transports may carry the same result as structured data and JSON text.
// Sanitize both before the result reaches model context or persisted messages.
export function sanitizeDocQueryResult(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed !== null && typeof parsed === 'object') {
        return JSON.stringify(sanitizeDocQueryResult(parsed))
      }
    } catch {
      // Plain text content is also a supported MCP representation.
    }
    return redactGateway(value)
  }
  if (Array.isArray(value)) return value.map(sanitizeDocQueryResult)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizeDocQueryResult(entry),
      ])
    )
  }
  return value
}

// A queue belongs to one discovered tool/client. Keep its slot until the raw
// provider operation settles, even if an outer graph deadline returns first.
export function serializeDocQueryExecution<
  Options extends { abortSignal?: AbortSignal },
  Result,
>(
  execute: (input: unknown, options: Options) => Result | PromiseLike<Result>
): (input: unknown, options: Options) => Promise<Result> {
  let pending = Promise.resolve()
  return (input, options) => {
    const result = pending.then(async () => {
      options.abortSignal?.throwIfAborted()
      const output = await execute(input, options)
      options.abortSignal?.throwIfAborted()
      if (output === null || output === undefined) {
        throw new Error('Document retrieval returned no result')
      }
      return output
    })
    pending = result.then(
      () => undefined,
      () => undefined
    )
    const signal = options.abortSignal
    if (!signal) return result
    if (signal.aborted) return Promise.reject(signal.reason)
    let abort: () => void = () => undefined
    const aborted = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
    })
    return Promise.race([result, aborted]).finally(() => {
      signal.removeEventListener('abort', abort)
    })
  }
}
