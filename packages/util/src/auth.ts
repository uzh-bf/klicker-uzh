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

/** Raw cookie names shared by server, SSR, proxy, and worker callers. */
export const COOKIE_NAMES = {
  LTI_TOKEN: 'lti-token',
  NEXT_AUTH_MANAGER_SESSION: 'next-auth.session-token',
  NEXT_AUTH_PARTICIPANT_SESSION: 'next-auth.participant-session-token',
  NEXT_AUTH_CSRF_TOKEN: 'next-auth.csrf-token',
  NEXT_AUTH_AUDIENCE: {
    participant: 'next-auth.participant',
    lecturer: 'next-auth.lecturer',
  },
  PARTICIPANT_TOKEN: 'participant_token',
  TEMPORARY_PARTICIPANT_TOKEN: 'temporary_participant_token',
  CHAT_PARTICIPANT_TOKEN: 'chat_participant_token',
  PWA_CHAT_EMBED_SESSION: 'chat_pwa_embed_token',
  LIVE_QUIZ_PIN_PREFIX: 'live-quiz-pin-',
} as const

/**
 * Resolve a raw cookie name in the optional server runtime namespace.
 *
 * Resolution stays lazy so request-time configuration is available and the
 * legacy NEXT_PUBLIC_* value cannot be inlined by Next.js. This read also makes
 * a stale consumer fail closed on its first cookie-name resolution.
 */
export function cookieName(rawName: string, namespace?: string): string {
  const runtimeEnvironment = process.env
  const resolvedNamespace =
    namespace === undefined
      ? runtimeEnvironment.KLICKER_COOKIE_NAMESPACE
      : namespace
  const legacyPreviewId = runtimeEnvironment.NEXT_PUBLIC_PREVIEW_ID

  if (legacyPreviewId) {
    throw new Error(
      'NEXT_PUBLIC_PREVIEW_ID is no longer supported; ' +
        'use KLICKER_COOKIE_NAMESPACE'
    )
  }
  if (!resolvedNamespace) return rawName
  if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(resolvedNamespace)) {
    throw new Error(
      'KLICKER_COOKIE_NAMESPACE must be a lowercase ID of 1-32 characters'
    )
  }
  const prefix = rawName.startsWith('__Secure-')
    ? '__Secure-'
    : rawName.startsWith('__Host-')
      ? '__Host-'
      : ''
  return `${prefix}klicker-${resolvedNamespace}.${rawName.slice(prefix.length)}`
}

export function liveQuizPinCookieName(id: string): string {
  return cookieName(`${COOKIE_NAMES.LIVE_QUIZ_PIN_PREFIX}${id}`)
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

export function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null
  const trimmed = headerValue.trim()
  let separatorIndex = -1

  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index]
    if (
      char === ' ' ||
      char === '\t' ||
      char === '\n' ||
      char === '\r' ||
      char === '\f'
    ) {
      separatorIndex = index
      break
    }
  }

  if (separatorIndex === -1) return null
  if (trimmed.slice(0, separatorIndex).toLowerCase() !== 'bearer') return null

  const token = trimmed.slice(separatorIndex).trim()
  return token.length > 0 ? token : null
}

export function cookiesAvailableViaLtiProbe(
  cookies: Record<string, string | undefined>
): boolean {
  return !!cookies[cookieName(COOKIE_NAMES.LTI_TOKEN)]
}

export function cookieSecurityOptions({
  isProduction,
}: {
  isProduction: boolean
}): {
  secure: boolean
  sameSite: 'lax' | 'none'
  partitioned: boolean
} {
  return {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    partitioned: isProduction,
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
