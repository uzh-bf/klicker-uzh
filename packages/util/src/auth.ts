import { jwtVerify, SignJWT } from 'jose'

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

export const LTI_PROBE_COOKIE_NAME = 'lti-token'

export function cookiesAvailableViaLtiProbe(
  cookies: Record<string, string | undefined>
): boolean {
  return !!cookies[LTI_PROBE_COOKIE_NAME]
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

export type ResponseExampleBaselineJobScope = {
  ownerId: string
  chatbotId: string
  runId: string
  caseId: string
}

const BASELINE_JOB_ISSUER = 'klicker-baseline-worker'
const BASELINE_JOB_AUDIENCE = 'klicker-baseline-chat'
const BASELINE_JOB_TTL_SECONDS = 90

function baselineJobKey(secret: string | undefined) {
  if (!secret || secret.length < 32) throw new Error('BASELINE_JOB_UNAVAILABLE')
  return new TextEncoder().encode(secret)
}

function validBaselineScope(scope: ResponseExampleBaselineJobScope) {
  return Object.values(scope).every((value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
}

export async function signResponseExampleBaselineJob(
  scope: ResponseExampleBaselineJobScope,
  secret: string | undefined,
  now = new Date()
) {
  if (!validBaselineScope(scope)) throw new Error('BASELINE_JOB_INVALID')
  const issuedAt = Math.floor(now.getTime() / 1000)
  return new SignJWT({ ...scope, purpose: 'response-example-baseline' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(BASELINE_JOB_ISSUER)
    .setAudience(BASELINE_JOB_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + BASELINE_JOB_TTL_SECONDS)
    .sign(baselineJobKey(secret))
}

export async function verifyResponseExampleBaselineJob(
  token: string,
  expected: ResponseExampleBaselineJobScope,
  secret: string | undefined,
  now = new Date()
) {
  if (token.length > 4096 || !validBaselineScope(expected))
    throw new Error('BASELINE_JOB_INVALID')
  const { payload } = await jwtVerify(token, baselineJobKey(secret), {
    algorithms: ['HS256'],
    issuer: BASELINE_JOB_ISSUER,
    audience: BASELINE_JOB_AUDIENCE,
    currentDate: now,
  })
  if (
    payload.purpose !== 'response-example-baseline' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    payload.exp - payload.iat > BASELINE_JOB_TTL_SECONDS ||
    Object.entries(expected).some(([key, value]) => payload[key] !== value)
  ) {
    throw new Error('BASELINE_JOB_INVALID')
  }
}
