'use client'

import { useTranslations } from 'next-intl'
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  bindParticipantSession,
  checkParticipantSession,
  hasSharedParticipantCookies,
  isParticipantSessionStale,
  participantReloadUrl,
  readParticipantSession,
  subscribeParticipantSession,
} from './utils/participantSession'

export function ParticipantCookieRecovery({
  href = '/login',
}: {
  href?: string
}) {
  const t = useTranslations('pwa.serverError')
  return (
    <div data-cy="cookies-required-recovery" className="mx-auto max-w-xl p-6">
      <p className="my-4 text-gray-600">{t('cookiesRequiredMessage')}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-uzh-blue underline"
      >
        {t('cookiesRequiredAction')}
      </a>
    </div>
  )
}

export default function ParticipantSessionBoundary({
  children,
  expectedRevision,
  requireCookie = false,
  onSessionEstablished,
}: {
  children: ReactNode
  expectedRevision?: string
  requireCookie?: boolean
  onSessionEstablished?: () => void
}) {
  const [sharedCookies, setSharedCookies] = useState<boolean>()
  const [confirmedRevision, setConfirmedRevision] = useState<string>()
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
    (expectedRevision === undefined ||
      confirmedRevision !== expectedRevision) &&
    expectedRevision !== readParticipantSession()

  useEffect(() => {
    if (!requireCookie || confirmedRevision !== expectedRevision) {
      setConfirmedRevision(undefined)
    }
  }, [confirmedRevision, expectedRevision, requireCookie])

  useEffect(() => {
    let active = true
    void hasSharedParticipantCookies().then((available) => {
      if (active) setSharedCookies(available)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (refused || !sharedCookies) return
    let leaving = false
    const onBeforeUnload = () => {
      leaving = true
    }
    const check = (event?: Event) => {
      if (event?.type === 'pageshow') leaving = false
      if (checkParticipantSession()) return
      // A new document may already have replaced the cookies before this
      // document unloads. Do not overwrite its navigation with our old URL.
      if (leaving) return
      event?.preventDefault()
      event?.stopImmediatePropagation()
      window.location.replace(participantReloadUrl())
    }
    check()
    // Keep the handoff available for cookie recovery until the replacement
    // is accepted. A later refresh must use the shared session, not replay
    // a short-lived launch credential.
    if (requireCookie && checkParticipantSession()) {
      setConfirmedRevision(expectedRevision)
      onSessionEstablished?.()
    }
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
    window.addEventListener('beforeunload', onBeforeUnload)
    events.forEach((name) => window.addEventListener(name, check, true))
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.clearInterval(timer)
      events.forEach((name) => window.removeEventListener(name, check, true))
    }
  }, [
    refused,
    sharedCookies,
    requireCookie,
    expectedRevision,
    onSessionEstablished,
  ])

  if (refused || sharedCookies === false) {
    const current =
      typeof window === 'undefined' ? undefined : new URL(window.location.href)
    return (
      <ParticipantCookieRecovery
        href={
          current?.searchParams.has('jwt')
            ? current.href
            : `${process.env.NEXT_PUBLIC_PWA_URL?.replace(/\/$/, '') ?? ''}/login`
        }
      />
    )
  }
  return !sharedCookies || stale || mismatch ? null : children
}
