import type { GetServerSidePropsContext } from 'next'
import type getParticipantToken from './getParticipantToken'
import type { ParticipantTokenSource } from './getParticipantToken'

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
  tokenSource,
  locale,
}: {
  destination: string
  participantToken?: string | null
  cookiesAvailable?: boolean
  tokenSource?: ParticipantTokenSource
  locale?: string
}) {
  // Reconcile browser storage with the resolved session before leaving the course page.
  if (participantToken) {
    return {
      props: {
        redirectTo: destination,
        participantToken,
        cookiesAvailable: cookiesAvailable ?? false,
        tokenSource,
        messages: (await import(`@klicker-uzh/i18n/messages/${locale ?? 'en'}`))
          .default,
      },
    }
  }

  return { redirect: { destination, permanent: false } }
}

// Empty activity lists and populated course pages must carry the same resolved
// identity, including its provenance, through Next.js serialization.
export async function participantPageProps(
  auth: Awaited<ReturnType<typeof getParticipantToken>>,
  locale?: string
) {
  return {
    participantToken: auth.participantToken ?? null,
    cookiesAvailable: auth.cookiesAvailable,
    ...(auth.tokenSource ? { tokenSource: auth.tokenSource } : {}),
    messages: (await import(`@klicker-uzh/i18n/messages/${locale ?? 'en'}`))
      .default,
  }
}
