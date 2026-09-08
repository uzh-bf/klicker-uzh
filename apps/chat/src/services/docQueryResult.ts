import { createHash } from 'node:crypto'

function redactGateway(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"'\\]+/gi, (candidate) => {
    try {
      const url = new URL(candidate)
      const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
      if (
        hostname.endsWith('.svc') ||
        hostname.endsWith('.svc.cluster.local') ||
        url.pathname.startsWith('/api/ingestion/resources/')
      ) {
        return `document-${createHash('sha256').update(candidate).digest('hex').slice(0, 16)}`
      }
    } catch {
      // Non-URL text is preserved verbatim.
    }
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
