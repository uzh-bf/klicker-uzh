'use client'

import { type ReactNode, useEffect, useSyncExternalStore } from 'react'
import {
  bindParticipantSession,
  checkParticipantSession,
  isParticipantSessionStale,
  participantReloadUrl,
  readParticipantSession,
  subscribeParticipantSession,
} from './utils/participantSession'

export default function ParticipantSessionBoundary({
  children,
  expectedRevision,
  requireCookie = false,
}: {
  children: ReactNode
  expectedRevision?: string
  requireCookie?: boolean
}) {
  if (typeof window !== 'undefined') bindParticipantSession(expectedRevision)
  const stale = useSyncExternalStore(
    subscribeParticipantSession,
    isParticipantSessionStale,
    () => false
  )
  const mismatch =
    typeof window !== 'undefined' &&
    bindParticipantSession() !== readParticipantSession()
  const refused =
    typeof window !== 'undefined' &&
    requireCookie &&
    expectedRevision !== readParticipantSession()

  useEffect(() => {
    if (refused) {
      window.location.replace('/serverError?cookiesRequired=true')
      return
    }
    const check = (event?: Event) => {
      if (checkParticipantSession()) return
      event?.preventDefault()
      event?.stopImmediatePropagation()
      window.location.replace(participantReloadUrl())
    }
    check()
    const timer = window.setInterval(check, 1000)
    const events = [
      'focus',
      'pageshow',
      'visibilitychange',
      'pointerdown',
      'click',
      'keydown',
      'submit',
    ]
    events.forEach((name) => window.addEventListener(name, check, true))
    return () => {
      window.clearInterval(timer)
      events.forEach((name) => window.removeEventListener(name, check, true))
    }
  }, [refused])

  return stale || refused || mismatch ? null : children
}
