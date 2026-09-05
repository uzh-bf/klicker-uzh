import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ChatRecoveryCard } from '../components/chat-recovery-card'

export default async function NotFound() {
  const t = await getTranslations()
  const pwaBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'

  return (
    <ChatRecoveryCard
      dataCy="chat-not-found"
      logoAlt={t('chat.sidebar.logoAlt')}
      title={t('chat.recovery.notFoundTitle')}
      message={t('chat.recovery.notFoundMessage')}
    >
      <Link
        data-cy="chat-not-found-home"
        href={pwaBaseUrl}
        className="bg-primary hover:bg-primary/90 focus-visible:outline-primary/40 inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        prefetch={false}
      >
        {t('chat.recovery.openKlickerUzh')}
      </Link>
    </ChatRecoveryCard>
  )
}
