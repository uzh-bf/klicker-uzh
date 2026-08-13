'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChatRecoveryCard } from '../components/chat-recovery-card'

interface ChatErrorProps {
  readonly unstable_retry: () => void
}

export default function ChatError({ unstable_retry }: ChatErrorProps) {
  const t = useTranslations()
  const pwaBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'

  return (
    <ChatRecoveryCard
      dataCy="chat-error"
      logoAlt={t('chat.sidebar.logoAlt')}
      title={t('chat.recovery.errorTitle')}
      message={t('chat.recovery.errorMessage')}
    >
      <button
        type="button"
        data-cy="chat-error-retry"
        onClick={unstable_retry}
        className="bg-primary hover:bg-primary/90 focus-visible:outline-primary/40 inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t('chat.recovery.retry')}
      </button>
      <Link
        data-cy="chat-error-home"
        href={pwaBaseUrl}
        className="border-border text-foreground hover:bg-muted focus-visible:outline-primary/40 inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        prefetch={false}
      >
        {t('chat.recovery.openKlickerUzh')}
      </Link>
    </ChatRecoveryCard>
  )
}
