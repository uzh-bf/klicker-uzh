import DpoDraftFrame from '@klicker-uzh/shared-components/src/DpoDraftFrame'
import { H1, Select } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AccountDraft from '../components/dpo-draft/AccountDraft'
import ParticipantJourneys from '../components/dpo-draft/ParticipantJourneys'

const views = [
  'account',
  'eduid',
  'assessment',
  'gate',
  'settings',
  'leaderboard',
] as const

export default function DpoDraft() {
  const t = useTranslations()
  const [view, setView] = useState<(typeof views)[number]>('account')
  return (
    <DpoDraftFrame>
      <label htmlFor="dpo-view">{t('dpoDraft.reviewTitle')}</label>
      <Select
        id="dpo-view"
        value={view}
        items={views.map((value) => ({
          value,
          label: t(
            value === 'account'
              ? 'dpoDraft.account.submit'
              : `dpoDraft.participant.${value}.title`
          ),
        }))}
        onChange={(value) => setView(value as (typeof views)[number])}
        data={{ cy: 'dpo-view' }}
        className={{ trigger: 'w-full' }}
      />
      {view === 'account' ? (
        <>
          <H1>{t('dpoDraft.account.submit')}</H1>
          <AccountDraft />
        </>
      ) : (
        <ParticipantJourneys key={view} view={view} />
      )}
    </DpoDraftFrame>
  )
}

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  if (process.env.NODE_ENV !== 'development') return { notFound: true }
  const messages = (
    await import(`@klicker-uzh/i18n/messages/${locale === 'de' ? 'de' : 'en'}`)
  ).default
  return { props: { messages } }
}
