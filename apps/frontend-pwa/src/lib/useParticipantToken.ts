import { useRouter } from 'next/router'
import { useEffect } from 'react'

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
