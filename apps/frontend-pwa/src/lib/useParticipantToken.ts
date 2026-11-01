import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { ParticipantTokenSource } from './getParticipantToken'

export default function useParticipantToken({
  participantToken,
  cookiesAvailable,
  redirectTo,
  callback,
  tokenSource,
}: {
  participantToken?: string | null
  cookiesAvailable?: boolean
  redirectTo?: string
  callback?: () => void
  tokenSource?: ParticipantTokenSource
}) {
  const router = useRouter()

  useEffect(() => {
    if (typeof participantToken !== 'string') {
      return
    }

    const storedToken = sessionStorage.getItem('participant_token')

    // The cookie-backed session is authoritative: drop any shadowing storage
    // copy so subsequent requests cannot pin an outdated bearer token.
    if (cookiesAvailable) {
      if (storedToken) {
        sessionStorage.removeItem('participant_token')

        if (redirectTo) {
          router.push(redirectTo)
        } else {
          callback?.()
        }
      }
      return
    }

    if (storedToken === participantToken) {
      return
    }

    if (!storedToken || tokenSource === 'lti') {
      sessionStorage.setItem('participant_token', participantToken)

      if (redirectTo) {
        router.push(`${redirectTo}?participantToken=${participantToken}`, {
          query: {
            ...router.query,
            participantToken,
          },
        })
      } else {
        callback?.()
      }
    }
    // An unverified relay token differing from the stored session is
    // ignored: the established session stays authoritative. Only a freshly
    // verified LTI handoff may replace it, or an induced link carrying a
    // raw ?participantToken= value would substitute the identity.
  }, [participantToken, cookiesAvailable, tokenSource])
}
