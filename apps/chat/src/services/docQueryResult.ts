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
