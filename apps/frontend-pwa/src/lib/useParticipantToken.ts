import {
  bootstrapTokenFromUrl,
  getStoredAuthToken,
} from '@klicker-uzh/util/client-auth'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const PARTICIPANT_SESSION_STORAGE_KEY = 'participant_token'
const PARTICIPANT_QUERY_KEY = 'participantToken'

function removeStoredParticipantToken(): boolean {
  try {
    sessionStorage.removeItem(PARTICIPANT_SESSION_STORAGE_KEY)
    return true
  } catch {
    return false
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
  const [installedParticipantToken, setInstalledParticipantToken] = useState<
    string | null
  >(null)
  const requiresSessionToken =
    typeof participantToken === 'string' && cookiesAvailable === false
  const isParticipantTokenReady =
    !requiresSessionToken || installedParticipantToken === participantToken

  useEffect(() => {
    if (typeof participantToken === 'string') {
      if (!cookiesAvailable) {
        if (
          getStoredAuthToken(PARTICIPANT_SESSION_STORAGE_KEY) !==
          participantToken
        ) {
          const storedParams = bootstrapTokenFromUrl(
            new URLSearchParams([[PARTICIPANT_QUERY_KEY, participantToken]]),
            {
              storageKey: PARTICIPANT_SESSION_STORAGE_KEY,
              queryKey: PARTICIPANT_QUERY_KEY,
            }
          )
          if (!storedParams) return

          if (redirectTo) {
            const separator = redirectTo.includes('?') ? '&' : '?'
            const searchParams = new URLSearchParams([
              [PARTICIPANT_QUERY_KEY, participantToken],
            ])
            router.push(`${redirectTo}${separator}${searchParams.toString()}`)
          } else {
            callback?.()
          }
        }
        setInstalledParticipantToken(participantToken)
      } else if (getStoredAuthToken(PARTICIPANT_SESSION_STORAGE_KEY)) {
        if (!removeStoredParticipantToken()) return

        if (redirectTo) {
          router.push(redirectTo)
        } else {
          callback?.()
        }
      }
    }
  }, [participantToken, cookiesAvailable])

  return isParticipantTokenReady
}
