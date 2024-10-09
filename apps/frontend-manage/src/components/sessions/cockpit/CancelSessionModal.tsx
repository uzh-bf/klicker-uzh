import { useMutation, useQuery } from '@apollo/client'
import {
  CancelSessionDocument,
  GetLiveQuizSummaryDocument,
  GetUserRunningSessionsDocument,
  GetUserSessionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import SessionAbortionConfirmations from './SessionAbortionConfirmations'

export interface SessionAbortionConfirmationType {
  deleteResponses: boolean
  deleteFeedbacks: boolean
  deleteConfusionFeedbacks: boolean
  deleteLeaderboardEntries: boolean
}

interface CancelSessionModalProps {
  sessionId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function CancelSessionModal({
  sessionId,
  title,
  open,
  setOpen,
}: CancelSessionModalProps) {
  const router = useRouter()
  const t = useTranslations()

  const initialConfirmations: SessionAbortionConfirmationType = {
    deleteResponses: false,
    deleteFeedbacks: false,
    deleteConfusionFeedbacks: false,
    deleteLeaderboardEntries: false,
  }

  const [confirmations, setConfirmations] =
    useState<SessionAbortionConfirmationType>({
      ...initialConfirmations,
    })

  // fetch course information
  const {
    data,
    loading: queryLoading,
    refetch,
  } = useQuery(GetLiveQuizSummaryDocument, {
    variables: { quizId: sessionId },
    skip: !open,
  })

  const [cancelSession, { loading: sessionDeleting }] = useMutation(
    CancelSessionDocument,
    {
      variables: { id: sessionId },
      refetchQueries: [
        {
          query: GetUserRunningSessionsDocument,
        },
        {
          query: GetUserSessionsDocument,
        },
      ],
    }
  )

  // manually re-trigger the query when the modal is opened
  useEffect(() => {
    if (open) {
      refetch()
    }
  }, [open])

  useEffect(() => {
    if (!data?.getLiveQuizSummary) {
      return
    }

    setConfirmations({
      deleteResponses: data.getLiveQuizSummary.numOfResponses === 0,
      deleteFeedbacks: data.getLiveQuizSummary.numOfFeedbacks === 0,
      deleteConfusionFeedbacks:
        data.getLiveQuizSummary.numOfConfusionFeedbacks === 0,
      deleteLeaderboardEntries:
        data.getLiveQuizSummary.numOfLeaderboardEntries === 0,
    })
  }, [data?.getLiveQuizSummary])

  if (!data?.getLiveQuizSummary) {
    return null
  }

  const summary = data.getLiveQuizSummary

  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false)
        setConfirmations({ ...initialConfirmations })
      }}
      className={{ content: '!w-full max-w-[60rem]' }}
      title={t('manage.cockpit.confirmAbortSession', { title: title })}
      onPrimaryAction={
        <Button
          loading={sessionDeleting}
          disabled={
            queryLoading ||
            Object.values(confirmations).some((confirmation) => !confirmation)
          }
          onClick={async () => {
            await cancelSession()
            router.push('/sessions')
            setOpen(false)
            setConfirmations({ ...initialConfirmations })
          }}
          className={{
            root: 'bg-red-700 text-white hover:bg-red-800 hover:text-white disabled:bg-opacity-50 disabled:hover:cursor-not-allowed',
          }}
          data={{ cy: 'confirm-cancel-session' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
            setConfirmations({ ...initialConfirmations })
          }}
          data={{ cy: 'abort-cancel-session' }}
        >
          {t('shared.generic.close')}
        </Button>
      }
    >
      <SessionAbortionConfirmations
        summary={summary}
        confirmations={confirmations}
        setConfirmations={setConfirmations}
      />
    </Modal>
  )
}

export default CancelSessionModal
