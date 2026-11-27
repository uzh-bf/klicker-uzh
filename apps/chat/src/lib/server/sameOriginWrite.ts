import { NextResponse } from 'next/server'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Cross-site request forgery guard for Chat's state-changing API routes.
 *
 * Participant sessions use `SameSite=None` cookies so Chat works inside LMS
 * and PWA iframes, so the browser attaches them to requests that any site
 * starts. A write is accepted only when the browser reports that it came from
 * the Chat origin itself. Embedded Chat passes, because the framed document
 * runs on the Chat origin and calls its own API.
 *
 * The comparison uses the host the request was addressed to
 * (`x-forwarded-host`, then `host`) instead of a configured origin, so every
 * deployment hostname and every local devrouter host works without
 * configuration, and TLS termination in front of the app does not matter. A
 * cross-site page cannot change those headers: a form cannot set headers, and
 * a fetch with custom headers needs a CORS preflight that Chat never approves.
 *
 * Decision order for a non-safe method:
 * 1. `Origin` present: its host must equal the request host. `Origin: null`
 *    (sandboxed frames, opaque redirects) is rejected.
 * 2. `Origin` absent: `Sec-Fetch-Site` must be `same-origin` or `none`.
 * 3. Neither header: allowed. Browsers send at least one of them on every
 *    cross-site write, so such a request is a non-browser client (load tests,
 *    scripted checks) that holds its own credential rather than a victim's
 *    ambient cookie.
 *
 * Returns a 403 response to send, or `null` when the request may proceed.
 */
export function rejectCrossSiteWrite(req: Request): NextResponse | null {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return null

  const origin = req.headers.get('origin')
  if (origin !== null) {
    const requestHost = getRequestHost(req)
    const originHost = parseOriginHost(origin)
    if (requestHost && originHost && originHost === requestHost) return null
    return forbidden()
  }

  const fetchSite = req.headers.get('sec-fetch-site')
  if (fetchSite === null) return null
  const site = fetchSite.trim().toLowerCase()
  if (site === 'same-origin' || site === 'none') return null
  return forbidden()
}

function getRequestHost(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwarded || req.headers.get('host')?.trim()
  return host ? host.toLowerCase() : null
}

function parseOriginHost(origin: string): string | null {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.host.toLowerCase()
  } catch {
    return null
  }
}

function forbidden(): NextResponse {
  return NextResponse.json(
    { error: 'Cross-site request rejected' },
    { status: 403 }
  )
}
