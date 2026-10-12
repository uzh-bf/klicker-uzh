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
}: {
  children: ReactNode
  expectedRevision?: string
  requireCookie?: boolean
}) {
  const [sharedCookies, setSharedCookies] = useState<boolean>()
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
  }, [refused, sharedCookies])

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
