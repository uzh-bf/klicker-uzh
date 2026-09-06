import DpoDraftFrame from '@klicker-uzh/shared-components/src/DpoDraftFrame'
import type { GetServerSidePropsContext } from 'next'

export default function DpoDraft() {
  return (
    <DpoDraftFrame>
      <div />
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
