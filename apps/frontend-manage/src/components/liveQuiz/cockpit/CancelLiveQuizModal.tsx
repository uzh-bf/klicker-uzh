import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { api } from '../../../lib/trpc'
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
  const utils = api.useUtils()

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

  const { data, isLoading: queryLoading } =
    api.activity.liveQuizSummary.useQuery({ activityId: quizId })
  const cancelLiveQuiz = api.liveQuiz.cancel.useMutation()

  useEffect(() => {
    if (!data?.liveQuizSummary) {
      return
    }

    setConfirmations({
      deleteResponses: data.liveQuizSummary.numOfResponses === 0,
      deleteFeedbacks: data.liveQuizSummary.numOfFeedbacks === 0,
      deleteConfusionFeedbacks:
        data.liveQuizSummary.numOfConfusionFeedbacks === 0,
      deleteLeaderboardEntries:
        data.liveQuizSummary.numOfLeaderboardEntries === 0,
    })
  }, [data?.liveQuizSummary])
  const summary = data?.liveQuizSummary

  return (
    <Modal
      open
      loading={queryLoading || !summary}
      onClose={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      title={t('manage.cockpit.confirmAbortLiveQuiz', { title: title })}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={cancelLiveQuiz.isLoading}
      primaryDisabled={
        queryLoading ||
        Object.values(confirmations).some((confirmation) => !confirmation)
      }
      onPrimaryAction={async () => {
        const result = await cancelLiveQuiz.mutateAsync({ id: quizId })
        if (result.liveQuiz?.id) {
          await utils.liveQuiz.running.invalidate()
          await utils.activity.liveQuizSummary.invalidate({
            activityId: quizId,
          })
        }
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
      {summary && (
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
