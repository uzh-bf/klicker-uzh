import { useMutation, useQuery } from '@apollo/client'
import {
  CancelLiveQuizDocument,
  GetLiveQuizSummaryDocument,
  GetUserLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import LiveQuizAbortionConfirmations from './LiveQuizAbortionConfirmations'

export interface LiveQuizAbortionConfirmationType {
  deleteResponses: boolean
  deleteFeedbacks: boolean
  deleteConfusionFeedbacks: boolean
  deleteLeaderboardEntries: boolean
}

function CancelLiveQuizModal({
  quizId,
  title,
  open,
  setOpen,
}: {
  quizId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}) {
  const router = useRouter()
  const t = useTranslations()

  const initialConfirmations: LiveQuizAbortionConfirmationType = {
    deleteResponses: false,
    deleteFeedbacks: false,
    deleteConfusionFeedbacks: false,
    deleteLeaderboardEntries: false,
  }

  const [confirmations, setConfirmations] =
    useState<LiveQuizAbortionConfirmationType>({
      ...initialConfirmations,
    })

  // fetch course information
  const {
    data,
    loading: queryLoading,
    refetch,
  } = useQuery(GetLiveQuizSummaryDocument, {
    variables: { quizId },
    skip: !open,
  })

  const [cancelLiveQuiz, { loading: quizDeleting }] = useMutation(
    CancelLiveQuizDocument,
    {
      variables: { id: quizId },
      update(cache, res) {
        const data = cache.readQuery({
          query: GetUserRunningLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserRunningLiveQuizzesDocument,
          data: {
            userRunningLiveQuizzes:
              data?.userRunningLiveQuizzes?.filter(
                (q) => q.id !== res.data?.cancelLiveQuiz?.id
              ) ?? [],
          },
        })
      },
      refetchQueries: [{ query: GetUserLiveQuizzesDocument }],
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
      title={t('manage.cockpit.confirmAbortLiveQuiz', { title: title })}
      onPrimaryAction={
        <Button
          loading={quizDeleting}
          disabled={
            queryLoading ||
            Object.values(confirmations).some((confirmation) => !confirmation)
          }
          onClick={async () => {
            await cancelLiveQuiz()
            router.push('/quizzes')
            setOpen(false)
            setConfirmations({ ...initialConfirmations })
          }}
          className={{
            root: 'bg-red-700 text-white hover:bg-red-800 hover:text-white disabled:bg-opacity-50 disabled:hover:cursor-not-allowed',
          }}
          data={{ cy: 'confirm-cancel-live-quiz' }}
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
          data={{ cy: 'abort-cancel-live-quiz' }}
        >
          {t('shared.generic.close')}
        </Button>
      }
    >
      <LiveQuizAbortionConfirmations
        summary={summary}
        confirmations={confirmations}
        setConfirmations={setConfirmations}
      />
    </Modal>
  )
}

export default CancelLiveQuizModal
