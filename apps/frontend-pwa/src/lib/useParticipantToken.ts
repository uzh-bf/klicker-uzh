import { useRouter } from 'next/router'
import { useEffect } from 'react'

function getParticipantTokenRedirect(
  redirectTo: string,
  participantToken: string
) {
  const target = new URL(redirectTo, window.location.origin)
  target.searchParams.set('participantToken', participantToken)

  return {
    pathname: target.pathname,
    query: Object.fromEntries(target.searchParams.entries()),
    hash: target.hash || undefined,
  }
}

export default function useParticipantToken({
  participantToken,
  cookiesAvailable,
  redirectTo,
  callback,
}: {
  participantToken?: string
  cookiesAvailable?: boolean
  redirectTo?: string
  callback?: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    if (typeof participantToken === 'string') {
      if (!cookiesAvailable) {
        if (!sessionStorage.getItem('participant_token')) {
          sessionStorage.setItem('participant_token', participantToken)

          if (redirectTo) {
            router.push(
              getParticipantTokenRedirect(redirectTo, participantToken)
            )
          } else {
            callback?.()
          }
        }
      } else {
        if (sessionStorage.getItem('participant_token')) {
          sessionStorage.removeItem('participant_token')

          if (redirectTo) {
            router.push(redirectTo)
          } else {
            callback?.()
          }
        }
      }
    }
  }, [participantToken, cookiesAvailable])
}
