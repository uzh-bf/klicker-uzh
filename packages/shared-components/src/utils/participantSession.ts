// The revision carries no identity or credential. Authentication stays in the
// shared HttpOnly cookie; this value binds rendered state to that session.
export const PARTICIPANT_SESSION_COOKIE = 'participant_session'
export const PARTICIPANT_SESSION_HEADER = 'x-participant-session'

let revision: string | undefined
let stale = false
const listeners = new Set<() => void>()

export async function hasSharedParticipantCookies() {
  if (window.self === window.top) return true
  // A cookie readable in an LMS frame may belong to a separate partition.
  // Only unpartitioned access can share the top-level participant login.
  return document.hasStorageAccess?.().catch(() => false) ?? false
}

export function readParticipantSession() {
  if (typeof document === 'undefined') return ''
  return (
    document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith(`${PARTICIPANT_SESSION_COOKIE}=`))
      ?.slice(PARTICIPANT_SESSION_COOKIE.length + 1) ?? ''
  )
}

export function bindParticipantSession(expected?: string) {
  revision ??= expected ?? readParticipantSession()
  return revision
}

export function isParticipantSessionStale() {
  return stale
}

export function subscribeParticipantSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function checkParticipantSession() {
  if (readParticipantSession() !== bindParticipantSession()) {
    stale = true
    listeners.forEach((listener) => listener())
  }
  return !stale
}

export function assertParticipantSession(expected = bindParticipantSession()) {
  if (!checkParticipantSession() || expected !== revision)
    throw new Error('Participant session changed')
}

// Called only after a successful cookie-changing command in this document.
// Other tabs keep their old binding and reload when they observe the revision.
export function acceptParticipantSession() {
  revision = readParticipantSession()
  stale = false
}

export function participantSessionHeaders() {
  assertParticipantSession()
  return { [PARTICIPANT_SESSION_HEADER]: bindParticipantSession() || 'none' }
}

export async function participantFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const expected = bindParticipantSession()
  const headers = new Headers(init?.headers)
  for (const [name, value] of Object.entries(participantSessionHeaders()))
    headers.set(name, value)
  const response = await fetch(input, { ...init, headers })
  assertParticipantSession(expected)
  return response
}

export function participantReloadUrl() {
  const url = new URL(window.location.href)
  for (const key of ['jwt', 'participantToken', 'token', 'session'])
    url.searchParams.delete(key)
  return url.href
}
