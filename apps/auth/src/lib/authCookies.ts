// Audience-specific temporary OAuth cookie configuration for NextAuth.
//
// NextAuth signs every temporary OAuth cookie (state, PKCE verifier, nonce)
// as an encrypted JWT whose key is derived from (secret, salt) where the salt
// is the cookie name (see next-auth core/lib/oauth/checks.js). Namespacing
// these cookies per audience therefore isolates overlapping participant and
// lecturer OAuth attempts: the salt makes a participant-issued state cookie
// undecryptable under the lecturer cookie name and vice versa.
//
// The persistent session cookies are intentionally NOT touched here; their
// names are the backend delivery contract (see constants.ts).

export type AuthAudience = 'participant' | 'lecturer'

// Matches next-auth's default STATE_MAX_AGE / PKCE_MAX_AGE (15 minutes),
// counted from OAuth initiation.
export const TEMP_COOKIE_MAX_AGE_S = 60 * 15

export function resolveSecureCookies(
  envUrl?: string,
  override?: string
): boolean {
  if (override === 'true') return true
  if (override === 'false') return false
  return Boolean(envUrl?.startsWith('https://'))
}

export function cookieNamePrefix(secure: boolean): string {
  return secure ? '__Secure-' : ''
}

export function audienceCookieNames(audience: AuthAudience, secure: boolean) {
  const prefix = `${cookieNamePrefix(secure)}next-auth.${audience}`
  return {
    state: `${prefix}.state`,
    pkceCodeVerifier: `${prefix}.pkce.code_verifier`,
    nonce: `${prefix}.nonce`,
    callbackUrl: `${prefix}.callback-url`,
  }
}

interface CookieSpec {
  name: string
  options: {
    httpOnly: boolean
    sameSite: 'lax'
    path: '/'
    secure: boolean
    maxAge?: number
  }
}

// The override block merged into NextAuthOptions.cookies for one audience.
// sessionToken and csrfToken are deliberately absent: the persistent session
// token is namespaced separately in the configs (unchanged contract), and the
// CSRF token stays a shared namespace because the client fetches CSRF material
// once before its audience-specific sign-in POST.
export function audienceCookieOptions(
  audience: AuthAudience,
  secure: boolean
): {
  state: CookieSpec
  pkceCodeVerifier: CookieSpec
  nonce: CookieSpec
  callbackUrl: CookieSpec
} {
  const names = audienceCookieNames(audience, secure)
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/' as const,
    secure,
  }
  return {
    state: {
      name: names.state,
      options: { ...base, maxAge: TEMP_COOKIE_MAX_AGE_S },
    },
    pkceCodeVerifier: {
      name: names.pkceCodeVerifier,
      options: { ...base, maxAge: TEMP_COOKIE_MAX_AGE_S },
    },
    nonce: {
      name: names.nonce,
      options: { ...base, maxAge: TEMP_COOKIE_MAX_AGE_S },
    },
    callbackUrl: {
      name: names.callbackUrl,
      options: { ...base },
    },
  }
}
