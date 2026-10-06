import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'

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
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true') {
      if (typeof participantToken === 'string') {
        if (!cookiesAvailable && !sessionStorage.getItem('participant_token')) {
          sessionStorage.setItem('participant_token', participantToken)
          if (redirectTo)
            void router.push(
              `${redirectTo}?participantToken=${participantToken}`,
              {
                query: { ...router.query, participantToken },
              }
            )
          else callbackRef.current?.()
        } else if (
          cookiesAvailable &&
          sessionStorage.getItem('participant_token')
        ) {
          sessionStorage.removeItem('participant_token')
          if (redirectTo) void router.push(redirectTo)
          else callbackRef.current?.()
        }
      }
      return
    }
    // The application boundary binds child queries to the verified credential.
    if (typeof participantToken === 'string') {
      if (redirectTo) void router.push(redirectTo)
      else callbackRef.current?.()
    }
  }, [participantToken, cookiesAvailable, redirectTo, router])
}
