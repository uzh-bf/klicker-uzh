// Centralized return-target validation for authentication redirects.
//
// Used by the proxy's early rejection (invalid initiation targets must be
// rejected before OAuth begins) and by the NextAuth redirect callbacks
// (the last gate before a redirect leaves the auth service). Allowed targets
// are absolute http(s) URLs on the exact allow-listed hosts, with deep-link
// paths and query strings preserved.

export interface RedirectTarget {
  ok: boolean
  url?: string
  reason?:
    | 'missing'
    | 'oversized'
    | 'malformed'
    | 'scheme'
    | 'credentials'
    | 'insecure'
    | 'host'
}

const MAX_REDIRECT_LENGTH = 2048

export function validateRedirectTarget(
  raw: string | undefined | null,
  allowedHosts: string[],
  opts: { secure: boolean }
): RedirectTarget {
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'missing' }
  if (raw.length > MAX_REDIRECT_LENGTH)
    return { ok: false, reason: 'oversized' }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'credentials' }
  }
  if (opts.secure && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'insecure' }
  }

  const hostOk = allowedHosts.some(
    (domain) => parsed.host === domain || parsed.host.endsWith(`.${domain}`)
  )
  if (!hostOk) return { ok: false, reason: 'host' }

  return { ok: true, url: parsed.toString() }
}

export function hostFromUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  try {
    return new URL(raw).host
  } catch {
    return null
  }
}
