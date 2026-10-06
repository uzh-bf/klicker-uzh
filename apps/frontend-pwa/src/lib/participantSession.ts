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
    try {
      return window.sessionStorage.getItem('participant_token')
    } catch {
      return null
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

export function applyParticipantPageSession(
  page: ParticipantPageSession,
  expectedRevision = revision,
  baseToken = getParticipantSessionToken()
) {
  if (typeof window === 'undefined') return false
  if (expectedRevision !== revision) return false
  if (appliedPages.has(page)) return true
  if (!loaded) {
    // Storage changes must not alter the client identity captured during render.
    token = baseToken
    loaded = true
  }
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
  return true
}

export function projectParticipantPageSession(page: ParticipantPageSession) {
  const current = getParticipantSessionToken()
  const baseRevision = revision
  if (typeof window === 'undefined' || appliedPages.has(page)) {
    return { token: current, revision, baseRevision, baseToken: current }
  }
  const invalidate =
    page.resetParticipantSession ||
    page.sessionState === 'rejected' ||
    page.sessionState === 'registration_required' ||
    page.sessionState === 'exchange_unavailable'
  const next = invalidate
    ? null
    : page.participantToken && (page.tokenSource === 'explicit' || !current)
      ? page.participantToken
      : current
  return {
    token: next,
    revision: revision + (invalidate || next !== current ? 1 : 0),
    baseRevision,
    baseToken: current,
  }
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

export function observeParticipantSessionResult(
  result: Parameters<typeof isSuccessfulParticipantSessionResult>[0]
) {
  if (!isSuccessfulParticipantSessionResult(result)) return false
  setParticipantSessionToken(null, true)
  return true
}
