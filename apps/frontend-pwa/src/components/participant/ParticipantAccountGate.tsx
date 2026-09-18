import { useQuery } from '@apollo/client'
import {
  GetParticipantAccountDataUseDocument,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { participantDataUseReturn } from '@lib/participantDataUseReturn'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { type ReactNode, useEffect, useState } from 'react'

const supportPages = new Set([
  '/account/data-use',
  '/login',
  '/magicLogin',
  '/createAccount',
  '/course/[courseId]/createAccount',
  '/activation',
  '/verify',
  '/serverError',
  '/404',
  '/500',
])

export default function ParticipantAccountGate({
  children,
  participantToken,
  cookiesAvailable,
}: {
  children: ReactNode
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const router = useRouter()
  const t = useTranslations()
  const [ready, setReady] = useState(false)
  const supportPage = supportPages.has(router.pathname)

  useEffect(() => {
    if (participantToken && !cookiesAvailable) {
      sessionStorage.setItem('participant_token', participantToken)
    } else if (participantToken && cookiesAvailable) {
      sessionStorage.removeItem('participant_token')
    }
    setReady(true)
  }, [participantToken, cookiesAvailable])

  const self = useQuery(SelfDocument, {
    skip: !ready || supportPage,
    fetchPolicy: 'network-only',
  })
  const registered = self.data?.self?.role === UserRole.Participant
  const account = useQuery(GetParticipantAccountDataUseDocument, {
    skip: !ready || supportPage || !registered,
    fetchPolicy: 'network-only',
  })

  useEffect(() => {
    if (
      !supportPage &&
      account.data?.selfAccountDataUse?.isComplete === false
    ) {
      sessionStorage.setItem(
        'participant_data_use_return',
        participantDataUseReturn(window.location.href, window.location.origin)
      )
      void router.replace('/account/data-use')
    }
  }, [supportPage, account.data, router])

  if (supportPage) return children
  if (self.error || account.error) {
    return (
      <UserNotification type="error">
        {t('shared.generic.systemError')}
      </UserNotification>
    )
  }
  if (
    !ready ||
    self.loading ||
    !self.data ||
    (registered && !account.data?.selfAccountDataUse?.isComplete)
  ) {
    return <Loader />
  }
  return children
}
