import DpoDraftFrame from '@klicker-uzh/shared-components/src/DpoDraftFrame'
import { H1 } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import AccountDraft from '../components/dpo-draft/AccountDraft'

export default function DpoDraft() {
  const t = useTranslations()
  return (
    <DpoDraftFrame>
      <H1>{t('dpoDraft.account.submit')}</H1>
      <AccountDraft />
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
