import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default async function useParticipantToken({
  participantToken,
  cookiesAvailable,
  redirectTo,
}: {
  participantToken?: string
  cookiesAvailable?: boolean
  redirectTo?: string
}) {
  const router = useRouter()

  useEffect(() => {
    if (participantToken) {
      if (!cookiesAvailable) {
        if (!sessionStorage.getItem('participant_token')) {
          sessionStorage.setItem('participant_token', participantToken)
          if (redirectTo) {
            router.push(redirectTo)
          } else {
            router.reload()
          }
        }
      } else {
        if (sessionStorage.getItem('participant_token')) {
          sessionStorage.removeItem('participant_token')
          if (redirectTo) {
            router.push(redirectTo)
          } else {
            router.reload()
          }
        }
      }
    }
  }, [participantToken, cookiesAvailable])
}
