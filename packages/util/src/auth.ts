import { type JWTPayload, verifyJWT } from './jwt.js'

/**
 * Parse a Cookie header string into a key-value map.
 * Decodes URL-encoded values, keeps raw value if decoding fails.
 */
export function parseCookiesHeader(
  cookieHeader: string | undefined
): Record<string, string> {
  const header = cookieHeader || ''
  const map: Record<string, string> = {}
  header.split(';').forEach((part) => {
    const [rawKey, ...rawVal] = part.split('=')
    if (!rawKey) return
    const key = rawKey.trim()
    const value = rawVal.join('=').trim()
    if (!key) return
    try {
      map[key] = decodeURIComponent(value)
    } catch {
      map[key] = value
    }
  })
  return map
}

const EXPLICIT_BEARER_PATTERN = /^Bearer\s+(\S+)$/i

/**
 * Verify an `Authorization: Bearer <token>` value as an explicit participant
 * credential. It must carry participant claims: a nonempty subject, a finite
 * future expiration, a participant role and no scope. Returns null for any
 * other value, so callers can fail closed instead of falling back to cookies.
 */
export async function verifyExplicitParticipantBearer(
  authorization: unknown,
  secret: string
): Promise<{ token: string; payload: JWTPayload } | null> {
  const token =
    typeof authorization === 'string'
      ? EXPLICIT_BEARER_PATTERN.exec(authorization.trim())?.[1]
      : undefined
  if (!token) return null
  try {
    const payload = await verifyJWT(token, secret, { algorithms: ['HS256'] })

    const expiresAt = payload.exp
    if (
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0 ||
      typeof expiresAt !== 'number' ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() / 1000 ||
      (payload.role !== 'PARTICIPANT' &&
        payload.role !== 'TEMPORARY_PARTICIPANT') ||
      payload.scope !== undefined
    ) {
      return null
    }

    return { token, payload }
  } catch {
    return null
  }
}

/**
 * Whether a request origin's host lies inside the configured cookie domain.
 * A foreign host that merely contains a subdomain name does not qualify, and
 * without a configured cookie domain no origin does.
 */
export function isCookieDomainOrigin(origin: unknown): boolean {
  const cookieDomain = process.env.COOKIE_DOMAIN?.replace(/^\./, '')
  if (!cookieDomain) return false
  if (typeof origin !== 'string') return false
  try {
    const { hostname } = new URL(origin)
    return hostname === cookieDomain || hostname.endsWith(`.${cookieDomain}`)
  } catch {
    return false
  }
}

/**
 * Parse a comma-separated host list into an array, trimming whitespace and removing empties.
 */
export function parseCsvHosts(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Extract provider from an affiliation identifier (e.g., user@df.uzh.ch -> df).
 */
export function extractProviderFromAffiliationId(
  affiliationId: string
): string | null {
  try {
    const parts = affiliationId.split('@')
    if (parts.length < 2) return null
    const domainParts = parts[1]?.split('.')
    if (!domainParts || domainParts.length === 0) return null
    const provider = domainParts[0]
    return provider || null
  } catch {
    return null
  }
}

/**
 * Reduce over affiliation strings to determine whether the Catalyst flag should be set.
 * Returns true if any affiliation domain contains 'uzh.ch' or 'usz.ch'.
 */
export function reduceCatalyst(acc: boolean, affiliation: string): boolean {
  try {
    const parts = affiliation.split('@')
    if (parts.length < 2) return acc || false
    const domain = parts[1]
    if (domain?.includes('uzh.ch') || domain?.includes('usz.ch')) {
      return true
    }
    return acc || false
  } catch {
    return false
  }
}

/**
 * Generate a random alphanumeric string of the given length.
 * Only characters A-Z, a-z, 0-9 are used.
 */
export function generateRandomString(length: number): string {
  let result = ''
  let characters: string
  for (let i = 0; i < length; i++) {
    if (i === 0 || i === length - 1) {
      characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    } else {
      characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    }
    const charactersLength = characters.length
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

/**
 * Derive a cookie domain from a NEXTAUTH_URL-style URL string.
 * Returns undefined for localhost, IPs, or hosts without at least two labels after removing the first label.
 */
export function deriveCookieDomainFromURL(url?: string): string | undefined {
  try {
    if (!url) return undefined
    const hostname = new URL(url).hostname
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return undefined
    }
    const parts = hostname.split('.')
    if (parts.length < 2) return undefined
    parts.shift()
    if (parts.length < 2) return undefined
    return parts.join('.')
  } catch {
    return undefined
  }
}
