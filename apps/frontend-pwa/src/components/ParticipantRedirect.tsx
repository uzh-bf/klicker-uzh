import Loader from '@klicker-uzh/shared-components/src/Loader'
import type { ParticipantTokenSource } from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function ParticipantRedirect({
  participantToken,
  redirectTo,
  cookiesAvailable,
  tokenSource,
}: {
  participantToken: string
  redirectTo: string
  cookiesAvailable?: boolean
  tokenSource?: ParticipantTokenSource
}) {
  useParticipantToken({ participantToken, cookiesAvailable, tokenSource })
  const router = useRouter()

  useEffect(() => {
    void router.replace(redirectTo)
  }, [redirectTo, router])

  return <Loader />
}
