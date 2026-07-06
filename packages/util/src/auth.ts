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
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint32Array(length)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
      result += characters.charAt(randomValues[i]! % charactersLength)
    }
  } else {
    // Fallback if Web Crypto is somehow unavailable
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
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
