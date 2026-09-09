import type { GetServerSidePropsContext } from 'next'

export function preserveLtiQuery(
  destination: string,
  query: GetServerSidePropsContext['query']
) {
  if (typeof query.jwt !== 'string') return destination
  const separator = destination.includes('?') ? '&' : '?'
  return `${destination}${separator}${new URLSearchParams({ jwt: query.jwt })}`
}

export async function participantRedirect({
  destination,
  participantToken,
  cookiesAvailable,
  locale,
}: {
  destination: string
  participantToken?: string | null
  cookiesAvailable?: boolean
  locale?: string
}) {
  // Reconcile browser storage with the resolved session before leaving the course page.
  if (participantToken) {
    return {
      props: {
        redirectTo: destination,
        participantToken,
        cookiesAvailable: cookiesAvailable ?? false,
        messages: (await import(`@klicker-uzh/i18n/messages/${locale ?? 'en'}`))
          .default,
      },
    }
  }

  return { redirect: { destination, permanent: false } }
}
