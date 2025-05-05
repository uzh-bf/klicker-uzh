import { useMutation, useQuery } from '@apollo/client'
import {
  CancelLiveQuizDocument,
  GetLiveQuizSummaryDocument,
  GetUserActivitiesDocument,
  GetUserLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  UserProfileDocument,
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

  // TODO: remove, once migration to single activity overwiew has been completed
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

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
  const { data, loading: queryLoading } = useQuery(GetLiveQuizSummaryDocument, {
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
      refetchQueries: [
        { query: GetUserLiveQuizzesDocument },
        { query: GetUserActivitiesDocument },
      ],
    }
  )

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
          destructive
          loading={quizDeleting}
          disabled={
            queryLoading ||
            Object.values(confirmations).some((confirmation) => !confirmation)
          }
          onClick={async () => {
            await cancelLiveQuiz()
            router.push(
              dataUser?.userProfile?.privatePreview ? '/activities' : '/quizzes'
            )
            setOpen(false)
            setConfirmations({ ...initialConfirmations })
          }}
          data={{ cy: 'confirm-cancel-live-quiz' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
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
          <Button.Label>{t('shared.generic.close')}</Button.Label>
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
