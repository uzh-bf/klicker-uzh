import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

export default function DpoDraftFrame({ children }: { children: ReactNode }) {
  const t = useTranslations()
  const locale = useLocale()
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b-8 border-uzh-red-60 bg-slate-700 px-3 py-2 text-white">
        <b>KlickerUZH · {t('dpoDraft.reviewTitle')}</b>
        <a
          data-cy="dpo-locale"
          href={`/${locale === 'de' ? 'en' : 'de'}/dpo-draft`}
          className="underline"
        >
          {t('dpoDraft.switchLocale')}
        </a>
      </header>
      <main className="mx-auto w-full max-w-[1122px] space-y-4 p-4">
        <aside
          className="rounded bg-slate-100 p-3 text-sm"
          data-cy="dpo-review-notice"
        >
          {t('dpoDraft.reviewNotice')}
        </aside>
        {children}
      </main>
    </>
  )
}
