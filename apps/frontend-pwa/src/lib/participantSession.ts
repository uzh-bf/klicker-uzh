import type { ParticipantSessionResult } from './getParticipantToken'

export type ParticipantPageSession = Partial<
  Pick<
    ParticipantSessionResult,
    'participantToken' | 'sessionState' | 'tokenSource'
  >
> & { resetParticipantSession?: boolean }

// Only explicit credentials are kept here: an LTI exchange or account creation
// whose cookie the browser may refuse. Cookie sessions are never copied into
// the tab, so a logout in one tab reaches every cookie-authenticated tab on
// its next request. A frame that holds an explicit credential keeps it until
// it relaunches or logs out itself.
const STORAGE_KEY = 'participant_token'

let token: string | null | undefined
let generation = 0
let version = 0
const listeners = new Set<() => void>()

function store(next: string | null) {
  token = next
  try {
    if (next) window.sessionStorage.setItem(STORAGE_KEY, next)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // A denied storage area must not discard the current document's session.
  }
}

function notify() {
  version += 1
  listeners.forEach((listener) => listener())
}

export function getParticipantSessionToken() {
  if (typeof window === 'undefined') return null
  if (token === undefined) {
    try {
      token = window.sessionStorage.getItem(STORAGE_KEY)
    } catch {
      token = null
    }
  }
  return token
}

// Changes whenever the identity ends; clients bound to an older generation
// must not be reused.
export function getParticipantSessionGeneration() {
  return generation
}

export function getParticipantSessionVersion() {
  return version
}

export function subscribeParticipantSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setParticipantSessionToken(next: string | null) {
  if (typeof window === 'undefined' || getParticipantSessionToken() === next)
    return
  store(next)
  notify()
}

export function invalidateParticipantSession() {
  if (typeof window === 'undefined') return
  store(null)
  generation += 1
  notify()
}

export function endsParticipantSession(page: ParticipantPageSession) {
  return (
    !!page.resetParticipantSession ||
    page.sessionState === 'rejected' ||
    page.sessionState === 'registration_required' ||
    page.sessionState === 'exchange_unavailable'
  )
}

// The bearer a page's client sends: the page's own explicit credential, none
// when the page ends the session, and otherwise the explicit credential this
// tab received earlier, which takes precedence over any cookie session.
export function resolveParticipantPageToken(page: ParticipantPageSession) {
  if (endsParticipantSession(page)) return null
  if (page.tokenSource === 'explicit' && page.participantToken)
    return page.participantToken
  return getParticipantSessionToken()
}

export function applyParticipantPageSession(page: ParticipantPageSession) {
  if (endsParticipantSession(page)) invalidateParticipantSession()
  else if (page.tokenSource === 'explicit' && page.participantToken)
    setParticipantSessionToken(page.participantToken)
}

export function isSuccessfulParticipantSessionResult(result: {
  data?: Record<string, unknown> | null
  errors?: readonly unknown[]
}) {
  if (result.errors?.length || !result.data) return false
  const data = result.data
  return (
    data.deleteParticipantAccount === true ||
    data.logoutTemporaryParticipant === true ||
    [
      'logoutParticipant',
      'loginParticipant',
      'loginParticipantMagicLink',
      'activateParticipantAccount',
    ].some((field) => typeof data[field] === 'string' && !!data[field])
  )
}
