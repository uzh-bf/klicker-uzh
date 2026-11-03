import { randomBytes } from 'node:crypto'

// Structured auth telemetry.
//
// One JSON line per event, carrying only non-sensitive fields: no state,
// code, token or cookie values, no raw authentication query strings, and no
// arbitrary deep-link contents — destinations are reduced to their host.
// Outcome categories distinguish expired/missing transaction context from
// provider-side failures so incidents can be triaged without exporting
// authentication material.
//
// This module must stay dependency-free: it is imported directly by
// node:test scripts (see scripts/*.mts).

const values = (list: string) => new Set(list.split(' '))
const allowed = {
  event: values(
    'auth.request auth.initiation auth.initiation_rejected auth.callback_rejected auth.callback_context auth.callback_destination auth.account_handling auth.redirect auth.failure_recovery auth.student_session_lookup auth.helper.invitation auth.helper.affiliation auth.helper.participant auth.helper.notification auth.nextauth_error auth.nextauth_warning auth.configuration'
  ),
  method: values('GET POST PUT PATCH DELETE OPTIONS HEAD'),
  action: values(
    'signin signout callback session csrf providers error verify-request unknown invitation_lookup invitation_accept invitation_process user_affiliation_link participant_affiliation_link participant_account_link notification'
  ),
  provider: values('eduid credentials'),
  audience: values('participant lecturer'),
  outcome: values(
    'stored default start linked allowed fallback resolved provider_error duplicate_state invalid_state_param no_state_match ambiguous_state_match contradictory_audience participant_restart infrastructure_error profile_missing participant_missing participant_link_failed affiliation_link_failed participant_affiliation_link_failed lookup_skipped lookup_missed no_eligible_invitations pending_invitations_found no_pending_invitations invitation_accept_failed invitation_processing_failed invitation_auto_accept_failed library_error library_warning configuration_error notification_failed'
  ),
  error: values(
    'missing oversized malformed scheme credentials insecure host duplicate_state invalid_state_param no_state_match ambiguous_state_match P1001 OAuthCallback oauth_callback oauth_signin credentials_callback session adapter configuration database account provider_profile invitation affiliation notification'
  ),
}

export interface AuthCorrelationId {
  readonly value: string
}

export function createAuthCorrelationId(): AuthCorrelationId {
  return { value: `na-${randomBytes(6).toString('hex')}` }
}

interface AuthEventFields {
  audience?: string | null
  providerId?: string
  outcome?: string
  destination?: string | null
  destinationHost?: string | null
  elapsedMs?: number
  errorCategory?: string
  action?: string
  method?: string
}

function category(value: unknown, field: keyof typeof allowed): string {
  return typeof value === 'string' && allowed[field].has(value)
    ? value
    : 'other'
}

function normalizeProvider(value: unknown): string {
  if (value === 'eduid' || value === process.env.NEXT_PUBLIC_EDUID_ID) {
    return 'eduid'
  }
  return category(value, 'provider')
}

function parsedHost(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const url = value.includes('://')
      ? new URL(value)
      : new URL(`https://${value}`)
    if (url.username || url.password) return null
    return url.host.toLowerCase()
  } catch {
    return null
  }
}

function configuredDestinationHosts(): Set<string> {
  const hosts = new Set<string>()
  for (const name of [
    'AUTH_STUDENT_ALLOWED_HOSTS',
    'AUTH_LECTURER_ALLOWED_HOSTS',
  ]) {
    for (const host of (process.env[name] ?? '').split(',')) {
      const normalized = parsedHost(host.trim())
      if (normalized) hosts.add(normalized)
    }
  }

  for (const name of [
    'APP_ORIGIN_AUTH',
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_ASSESSMENT_URL',
  ]) {
    const value = process.env[name]
    const normalized = value ? parsedHost(value) : null
    if (normalized) hosts.add(normalized)
  }
  return hosts
}

function normalizeDestinationHost(
  destinationHost: string | null | undefined,
  destination: string | null | undefined
): string | null {
  const value = destinationHost ?? destination
  if (value == null) return null
  const host = parsedHost(value)
  return host && configuredDestinationHosts().has(host) ? host : 'other'
}

function normalizeRequestId(requestId: unknown): string {
  if (
    requestId &&
    typeof requestId === 'object' &&
    'value' in requestId &&
    typeof requestId.value === 'string' &&
    /^na-[a-f0-9]{12}$/.test(requestId.value)
  ) {
    return requestId.value
  }
  return createAuthCorrelationId().value
}

function safeRelease(value: string | undefined): string | undefined {
  return value && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(value)
    ? value
    : undefined
}

export function authEvent(
  event: string,
  requestId: AuthCorrelationId | string | undefined,
  fields: AuthEventFields = {}
) {
  const safeEvent = category(event, 'event')
  const route =
    safeEvent === 'auth.student_session_lookup'
      ? '/api/student-session'
      : '/api/auth/[...nextauth]'
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    event: safeEvent,
    requestId: normalizeRequestId(requestId),
    route,
    release: safeRelease(process.env.APP_VERSION),
  }

  if (fields.audience !== undefined) {
    record.audience =
      fields.audience === null ? null : category(fields.audience, 'audience')
  }
  if (fields.providerId !== undefined) {
    record.providerId = normalizeProvider(fields.providerId)
  }
  if (fields.outcome !== undefined) {
    record.outcome = category(fields.outcome, 'outcome')
  }
  if (fields.action !== undefined) {
    record.action = category(fields.action, 'action')
  }
  if (fields.method !== undefined) {
    const method =
      typeof fields.method === 'string'
        ? fields.method.toUpperCase()
        : undefined
    record.method = category(method, 'method')
  }
  if (fields.errorCategory !== undefined) {
    record.errorCategory = category(fields.errorCategory, 'error')
  }
  if (fields.elapsedMs !== undefined && Number.isFinite(fields.elapsedMs)) {
    record.elapsedMs = Math.max(0, Math.trunc(fields.elapsedMs))
  }

  const destinationHost = normalizeDestinationHost(
    fields.destinationHost,
    fields.destination
  )
  if (destinationHost !== null) record.destinationHost = destinationHost

  console.log(JSON.stringify(record))
}
