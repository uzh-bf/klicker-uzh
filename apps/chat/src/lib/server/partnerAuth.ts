import { createHash, timingSafeEqual } from 'node:crypto'

export const PARTNER_DOC_QUERY_KEYS_ENV = 'PARTNER_DOC_QUERY_KEYS'

function hashKey(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

function keysMatch(presented: string, configured: string): boolean {
  return timingSafeEqual(hashKey(presented), hashKey(configured))
}

function parsePartnerKeys(): Record<string, string> | null {
  const raw = process.env[PARTNER_DOC_QUERY_KEYS_ENV]?.trim()
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null
    }
    const entries = Object.entries(parsed).filter(
      ([id, key]) =>
        typeof id === 'string' &&
        id.trim().length > 0 &&
        typeof key === 'string' &&
        key.length > 0
    )
    if (entries.length === 0) return null
    return Object.fromEntries(entries)
  } catch {
    return null
  }
}

function extractPresentedKey(request: Request): string | null {
  const headerKey = request.headers.get('x-api-key')
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim()
  }
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    const bearer = authorization.slice('Bearer '.length).trim()
    if (bearer.length > 0) return bearer
  }
  return null
}

/**
 * Resolves the partner service identity from its server-side key. Keys are
 * configured per environment via PARTNER_DOC_QUERY_KEYS (JSON object mapping
 * partner slug to secret); a missing or malformed configuration disables
 * partner issuance entirely.
 */
export function resolvePartnerId(request: Request): string | null {
  const configured = parsePartnerKeys()
  if (!configured) return null
  const presented = extractPresentedKey(request)
  if (!presented) return null
  for (const [partnerId, key] of Object.entries(configured)) {
    if (keysMatch(presented, key)) return partnerId
  }
  return null
}
