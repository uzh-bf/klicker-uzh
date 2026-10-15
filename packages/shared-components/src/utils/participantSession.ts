// The revision carries no identity or credential. Authentication stays in the
// shared HttpOnly cookie; this value binds rendered state to that session.
export const PARTICIPANT_SESSION_COOKIE = 'participant_session'
export const PARTICIPANT_SESSION_HEADER = 'x-participant-session'

// An LMS frame whose browser refuses the shared login cookie keeps its own
// participant token in this tab's sessionStorage and sends it as a bearer. That identity is fixed for the tab until the next
// launch, so the shared revision does not apply to it.
const FRAME_TOKEN_KEY = 'participant_token'

let revision: string | undefined
let stale = false
let localSessionChange = false
let frameToken: string | undefined
let frameLaunch: string | undefined
const listeners = new Set<() => void>()

export function isParticipantFrame() {
  return typeof window !== 'undefined' && window.self !== window.top
}

export async function hasSharedParticipantCookies() {
  if (window.self === window.top) return true
  // A cookie readable in an LMS frame may belong to a separate partition.
  // Only unpartitioned access can share the top-level participant login.
  return document.hasStorageAccess?.().catch(() => false) ?? false
}

/** Keep a launched token for this frame, or resume one stored earlier. */
export function adoptFrameSession(token?: string) {
  if (!isParticipantFrame()) return
  // Pages re-render with the same launch props, which must not revive a
  // session that has since ended.
  const launch = token && token !== frameLaunch ? token : undefined
  if (launch) frameLaunch = launch
  try {
    if (launch) sessionStorage.setItem(FRAME_TOKEN_KEY, launch)
    frameToken = sessionStorage.getItem(FRAME_TOKEN_KEY) ?? undefined
  } catch {
    frameToken = launch ?? frameToken
  }
}

export function frameSessionToken() {
  return frameToken
}

export function endFrameSession() {
  frameToken = undefined
  try {
    sessionStorage.removeItem(FRAME_TOKEN_KEY)
  } catch {}
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
  return revision ?? acceptParticipantSession(expected)
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
  if (!frameToken && readParticipantSession() !== bindParticipantSession()) {
    stale = true
    listeners.forEach((listener) => listener())
  }
  return !stale
}

export function assertParticipantSession(expected = bindParticipantSession()) {
  if (!checkParticipantSession() || (!frameToken && expected !== revision))
    throw new Error('Participant session changed')
}

// Initialize a new document against its server-rendered session, if supplied.
export function acceptParticipantSession(expected?: string) {
  revision = expected ?? readParticipantSession()
  stale = false
  localSessionChange = false
  return revision
}

export function hasLocalParticipantSessionChange() {
  return localSessionChange
}

// The command's caller owns the destination. Keep this document unusable even
// if that navigation is delayed or cancelled; only a new document can rebind.
export function completeParticipantSessionCommand() {
  localSessionChange = true
  stale = true
  listeners.forEach((listener) => listener())
}

// A frame session must be the only credential: a shared cookie the browser
// still sends would otherwise take precedence on the server.
export function participantSessionCredentials(): { credentials?: 'omit' } {
  return frameToken ? { credentials: 'omit' } : {}
}

export function participantSessionHeaders(): Record<string, string> {
  assertParticipantSession()
  if (frameToken) return { authorization: `Bearer ${frameToken}` }
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
  const response = await fetch(input, {
    ...init,
    headers,
    ...participantSessionCredentials(),
  })
  assertParticipantSession(expected)
  return response
}

export function participantReloadUrl() {
  const url = new URL(window.location.href)
  for (const key of ['jwt', 'participantToken', 'token'])
    url.searchParams.delete(key)
  return url.href
}
