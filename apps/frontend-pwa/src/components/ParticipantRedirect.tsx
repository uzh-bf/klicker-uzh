import Loader from '@klicker-uzh/shared-components/src/Loader'
import useParticipantToken from '@lib/useParticipantToken'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function ParticipantRedirect({
  participantToken,
  redirectTo,
  cookiesAvailable,
}: {
  participantToken: string
  redirectTo: string
  cookiesAvailable?: boolean
}) {
  useParticipantToken({ participantToken, cookiesAvailable })
  const router = useRouter()

  useEffect(() => {
    void router.replace(redirectTo)
  }, [redirectTo, router])

  return <Loader />
}
