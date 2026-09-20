// Participant recovery for NextAuth's own failure redirects.
//
// next-auth 4.24 answers OAuth failures with returned redirects rather than
// exceptions, and it routes them through its generic endpoints before the
// application gets another say:
//
//   core/routes/callback.js  -> `${url}/error?error=OAuthCallback` (token
//                               exchange failure, invalid PKCE material)
//   core/index.js            -> `${url}/signin?error=OAuthCallback` for
//                               OAuthCallback and other sign-in error codes,
//                               without consulting a configured error page
//   next/index.js            -> writes that target as a Location header, or as
//                               `{ url }` when the client requested JSON
//
// Both endpoints render the generic (lecturer-facing) sign-in journey, so a
// participant whose attempt was correctly classified would still be handed to
// lecturer authentication when retrying after a transient failure. Wrapping the
// response lets the handler rewrite exactly those generic endpoints for the
// participant audience into the neutral participant restart destination; every
// other destination, including the assessment deep link of a successful
// callback, passes through untouched.

const MAX_ERROR_CODE_LENGTH = 64
const SAFE_ERROR_CODE = new RegExp(
  `^[A-Za-z0-9_.-]{1,${MAX_ERROR_CODE_LENGTH}}$`
)

export const PARTICIPANT_RESTART_PATH = '/restart'

// Endpoints of the generic (lecturer-facing) sign-in journey, relative to the
// auth base URL the library builds them from.
const GENERIC_AUTH_PATHS = ['/error', '/signin']

// Fallback of next-auth's own URL parsing (utils/parse-url.js) when neither
// NEXTAUTH_URL nor a trusted forwarded host is configured.
const DEFAULT_AUTH_BASE = 'http://localhost:3000/api/auth'

export interface AuthRequestHeaders {
  host?: string
  'x-forwarded-host'?: string
  'x-forwarded-proto'?: string
}

// Base URL next-auth builds its generic error and sign-in redirects from. It
// derives that base from the request itself (utils/detect-origin.js plus
// utils/parse-url.js): NEXTAUTH_URL wins when it is configured, a trusted
// forwarded host is used otherwise, and the library falls back to
// http://localhost:3000/api/auth. The recovery rewrite compares against this
// exact base, so a different deployment shape can only leave a redirect
// untouched - never rewrite it to the wrong place.
export function authServiceBaseUrl(headers: AuthRequestHeaders): string {
  const configured = process.env.NEXTAUTH_URL
  const forwardedHost = headers['x-forwarded-host'] ?? headers.host
  const trustedHostOrigin =
    (process.env.VERCEL ?? process.env.AUTH_TRUST_HOST)
      ? `${headers['x-forwarded-proto'] === 'http' ? 'http' : 'https'}://${forwardedHost ?? ''}`
      : undefined

  try {
    const parsed = new URL(configured ?? trustedHostOrigin ?? DEFAULT_AUTH_BASE)
    const path = (
      parsed.pathname === '/' ? '/api/auth' : parsed.pathname
    ).replace(/\/$/, '')
    return `${parsed.origin}${path}`
  } catch {
    return DEFAULT_AUTH_BASE
  }
}

export function participantRestartTarget(errorCode?: string | null): string {
  // Error codes reach NextAuth from provider responses and its own error
  // messages, so only a short opaque token is carried over to the restart page.
  const code =
    typeof errorCode === 'string' && SAFE_ERROR_CODE.test(errorCode)
      ? errorCode
      : null
  const audience = 'audience=participant'
  return code
    ? `${PARTICIPANT_RESTART_PATH}?${audience}&error=${code}`
    : `${PARTICIPANT_RESTART_PATH}?${audience}`
}

// Returns the participant restart target when the library is about to send a
// participant to one of its generic endpoints, and `null` for every other
// destination. Relative locations are resolved against the auth base the library
// builds these redirects from.
export function rewriteParticipantFailureRedirect(
  location: string,
  authBase: string
): string | null {
  if (!location || !authBase) return null

  let target: URL
  let base: URL
  try {
    base = new URL(authBase)
    target = new URL(location, base)
  } catch {
    return null
  }

  if (target.origin !== base.origin) return null
  if (!target.pathname.startsWith(base.pathname)) return null
  const relativePath = target.pathname.slice(base.pathname.length)
  if (!GENERIC_AUTH_PATHS.includes(relativePath)) return null

  return participantRestartTarget(target.searchParams.get('error'))
}

export interface RewritableAuthResponse {
  setHeader(name: string, value: number | string | readonly string[]): unknown
  json?(body: unknown): unknown
}

export function installParticipantFailureRecovery(
  res: RewritableAuthResponse,
  options: {
    authBase: string
    onRewrite?: (from: string, to: string) => void
  }
): void {
  const { authBase, onRewrite } = options

  const originalSetHeader = res.setHeader.bind(res)
  res.setHeader = (name, value) => {
    if (name.toLowerCase() === 'location' && typeof value === 'string') {
      const rewritten = rewriteParticipantFailureRedirect(value, authBase)
      if (rewritten) {
        onRewrite?.(value, rewritten)
        return originalSetHeader(name, rewritten)
      }
    }
    return originalSetHeader(name, value)
  }

  const originalJson = res.json?.bind(res)
  if (!originalJson) return
  res.json = (body: unknown) => {
    const payload = body as { url?: unknown } | null
    if (payload && typeof payload.url === 'string') {
      const rewritten = rewriteParticipantFailureRedirect(payload.url, authBase)
      if (rewritten) {
        onRewrite?.(payload.url, rewritten)
        return originalJson({ ...payload, url: rewritten })
      }
    }
    return originalJson(body)
  }
}
