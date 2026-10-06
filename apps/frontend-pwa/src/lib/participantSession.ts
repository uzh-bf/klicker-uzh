import type { ParticipantSessionResult } from './getParticipantToken'

export type ParticipantPageSession = Partial<
  Pick<
    ParticipantSessionResult,
    'participantToken' | 'sessionState' | 'tokenSource'
  >
> & { resetParticipantSession?: boolean }

let token: string | null = null
let loaded = false
let revision = 0
const listeners = new Set<() => void>()
const appliedPages = new WeakSet<ParticipantPageSession>()

export function getParticipantSessionToken() {
  if (typeof window === 'undefined') return null
  if (!loaded) {
    loaded = true
    try {
      token = window.sessionStorage.getItem('participant_token')
    } catch {
      token = null
    }
  }
  return token
}

export function subscribeParticipantSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getParticipantSessionRevision() {
  return revision
}

export function setParticipantSessionToken(
  next: string | null,
  invalidate = false
) {
  if (typeof window === 'undefined') return
  const previous = getParticipantSessionToken()
  token = next
  loaded = true
  try {
    if (next) window.sessionStorage.setItem('participant_token', next)
    else window.sessionStorage.removeItem('participant_token')
  } catch {
    // A denied storage area must not discard the current document's session.
  }
  if (previous !== next || invalidate) {
    revision += 1
    listeners.forEach((listener) => listener())
  }
}

export function applyParticipantPageSession(page: ParticipantPageSession) {
  if (typeof window === 'undefined' || appliedPages.has(page)) return
  appliedPages.add(page)
  if (
    page.resetParticipantSession ||
    page.sessionState === 'rejected' ||
    page.sessionState === 'registration_required' ||
    page.sessionState === 'exchange_unavailable'
  ) {
    setParticipantSessionToken(null, true)
  } else if (
    page.participantToken &&
    (page.tokenSource === 'explicit' || !getParticipantSessionToken())
  ) {
    setParticipantSessionToken(page.participantToken)
  }
}

export function observeParticipantSessionResult(result: {
  data?: Record<string, unknown> | null
  errors?: readonly unknown[]
}) {
  if (result.errors?.length || !result.data) return false
  const data = result.data
  const success =
    data.deleteParticipantAccount === true ||
    data.logoutTemporaryParticipant === true ||
    [
      'logoutParticipant',
      'loginParticipant',
      'loginParticipantMagicLink',
      'activateParticipantAccount',
    ].some((field) => typeof data[field] === 'string' && !!data[field])
  if (success) setParticipantSessionToken(null, true)
  return success
}
