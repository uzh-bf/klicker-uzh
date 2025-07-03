import { useMutation, useQuery } from '@apollo/client'
import {
  CancelLiveQuizDocument,
  GetLiveQuizSummaryDocument,
  GetUserActivitiesDocument,
  GetUserLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Modal } from '@uzh-bf/design-system'
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
  onClose,
}: {
  quizId: string
  title: string
  onClose: () => void
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
  const summary = data?.getLiveQuizSummary

  return (
    <Modal
      open
      onClose={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      title={t('manage.cockpit.confirmAbortLiveQuiz', { title: title })}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={quizDeleting}
      primaryDisabled={
        queryLoading ||
        Object.values(confirmations).some((confirmation) => !confirmation)
      }
      onPrimaryAction={async () => {
        await cancelLiveQuiz()
        router.push('/activities')
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      dataPrimaryAction={{ cy: 'confirm-cancel-live-quiz' }}
      secondaryLabel={t('shared.generic.close')}
      onSecondaryAction={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      dataSecondaryAction={{ cy: 'abort-cancel-live-quiz' }}
      className={{ content: 'max-w-240' }}
    >
      {queryLoading || !summary ? (
        <Loader />
      ) : (
        <LiveQuizAbortionConfirmations
          summary={summary}
          confirmations={confirmations}
          setConfirmations={setConfirmations}
        />
      )}
    </Modal>
  )
}

export default CancelLiveQuizModal
