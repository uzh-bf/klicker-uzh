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
  participantToken?: string
  cookiesAvailable?: boolean
  redirectTo?: string
  callback?: () => void
  tokenSource?: ParticipantTokenSource
}) {
  const router = useRouter()

  useEffect(() => {
    if (typeof participantToken === 'string') {
      const storedToken = sessionStorage.getItem('participant_token')
      if (storedToken === participantToken) {
        return
      }

      if (!cookiesAvailable) {
        if (!storedToken) {
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
        } else if (tokenSource === 'lti') {
          // Only a freshly verified LTI handoff may replace an established
          // session. A raw ?participantToken= relay must not, or an induced
          // link substitutes the participant identity (login CSRF).
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
        // ignored: the established session stays authoritative.
      } else {
        if (storedToken) {
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
