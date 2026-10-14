// Strict action/audience dispatch for the NextAuth catch-all route.
//
// Replaces the former getAuthContext() heuristic, which consulted explicit
// query parameters, ephemeral redirect cookies and finally defaulted to the
// lecturer configuration — the default that let an expired participant OAuth
// attempt enter lecturer account handling on callback.
//
// The invariant enforced here: a login attempt's intended account audience is
// resolved once, from transaction-bound evidence only (the explicit initiation
// parameter, or the audience-namespaced state cookie that only the matching
// initiation could have set). When the evidence is missing, expired,
// malformed or contradictory, dispatch fails safely with `null` and the caller
// must not run any account handling.

import type { AuthAudience } from './authCookies'

export type AuthAction =
  | 'signin'
  | 'signout'
  | 'callback'
  | 'session'
  | 'csrf'
  | 'providers'
  | 'error'
  | 'verify-request'
  | 'unknown'

export type AuthQuery = Record<string, string | string[] | undefined>

export function parseAuthAction(nextauth: string[] | undefined): {
  action: AuthAction
  providerId?: string
} {
  const [rawAction, providerId] = nextauth ?? []
  const known: AuthAction[] = [
    'signin',
    'signout',
    'callback',
    'session',
    'csrf',
    'providers',
    'error',
    'verify-request',
  ]
  const action = known.includes(rawAction as AuthAction)
    ? (rawAction as AuthAction)
    : 'unknown'
  return { action, providerId }
}

// Initiation (sign-in/sign-out) requests carry their audience explicitly.
// The credentials (delegated) provider is a fixed lecturer route: accepting
// `participant=true` there would be a contradictory audience selection.
export function resolveInitiationAudience(params: {
  action: AuthAction
  providerId?: string
  query: AuthQuery
}): AuthAudience | null {
  const { action, providerId, query } = params
  if (action !== 'signin' && action !== 'signout') {
    // Generic endpoints (session, csrf, providers, error, verify-request)
    // keep the lecturer configuration; participants use the fixed
    // /api/student-session endpoint instead of the generic session action.
    return 'lecturer'
  }
  const wantsParticipant = query.participant === 'true'
  if (action === 'signin' && providerId === 'credentials') {
    return wantsParticipant ? null : 'lecturer'
  }
  return wantsParticipant ? 'participant' : 'lecturer'
}

export const MAX_STATE_PARAM_LENGTH = 512

export type DecodeStateCookie = (
  token: string,
  salt: string
) => Promise<Record<string, unknown> | null>

// Resolve the audience of an OAuth callback strictly from the
// audience-namespaced state cookies. Exactly one candidate must decrypt
// (signature + expiry are enforced by the NextAuth decoder via the salt),
// name the expected provider, and equal the single returned state parameter.
// Zero or multiple matches resolve to `null` — never to a default audience.
export async function resolveCallbackAudience(params: {
  query: AuthQuery
  cookies: Record<string, string | undefined>
  expectedProviderId: string
  candidates: { audience: AuthAudience; stateCookieName: string }[]
  decodeStateCookie: DecodeStateCookie
}): Promise<{ audience: AuthAudience } | { audience: null; reason: string }> {
  const { query, cookies, expectedProviderId, candidates, decodeStateCookie } =
    params

  const state = query.state
  if (Array.isArray(state)) return { audience: null, reason: 'duplicate_state' }
  if (
    typeof state !== 'string' ||
    state.length === 0 ||
    state.length > MAX_STATE_PARAM_LENGTH
  ) {
    return { audience: null, reason: 'invalid_state_param' }
  }

  const matches: AuthAudience[] = []
  for (const candidate of candidates) {
    const raw = cookies[candidate.stateCookieName]
    if (!raw) continue
    let payload: Record<string, unknown> | null = null
    try {
      payload = await decodeStateCookie(raw, candidate.stateCookieName)
    } catch {
      payload = null
    }
    if (!payload) continue
    if (payload.provider !== expectedProviderId) continue
    if (payload.value !== state) continue
    matches.push(candidate.audience)
  }

  const [match] = matches
  if (matches.length === 1 && match) return { audience: match }
  if (matches.length === 0) return { audience: null, reason: 'no_state_match' }
  return { audience: null, reason: 'ambiguous_state_match' }
}

// A callback returned by the identity provider with an error parameter has no
// authorization code to exchange and never performs account handling. The
// error response still echoes the state of the initiation, so the caller
// resolves the audience from the state cookies before applying this predicate:
// a verified participant is returned to the participant restart page with the
// bounded error code, while every other provider error stays neutral.
export function isProviderErrorCallback(query: AuthQuery): boolean {
  return query.error !== undefined
}
