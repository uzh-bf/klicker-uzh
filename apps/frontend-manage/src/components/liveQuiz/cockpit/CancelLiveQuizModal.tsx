import { Modal, UserNotification, toast } from '@uzh-bf/design-system'
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
  const [cancelPending, setCancelPending] = useState(false)

  const {
    data,
    error: summaryError,
    isLoading: queryLoading,
  } = api.activity.liveQuizSummary.useQuery({ activityId: quizId })
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
  const initialSummaryLoading = queryLoading && !summary
  const summaryUnavailable = Boolean(
    (summaryError || !queryLoading) && !summary
  )
  const cancelling = cancelLiveQuiz.isLoading || cancelPending
  const handleClose = () => {
    if (cancelling) return

    onClose()
    setConfirmations({ ...initialConfirmations })
  }

  return (
    <Modal
      open
      loading={initialSummaryLoading}
      onClose={handleClose}
      title={t('manage.cockpit.confirmAbortLiveQuiz', { title: title })}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={cancelling}
      primaryDisabled={
        cancelling ||
        initialSummaryLoading ||
        summaryUnavailable ||
        Object.values(confirmations).some((confirmation) => !confirmation)
      }
      onPrimaryAction={async () => {
        if (cancelling) return

        setCancelPending(true)

        try {
          const result = await cancelLiveQuiz.mutateAsync({ id: quizId })
          if (!result.liveQuiz?.id) {
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
            setCancelPending(false)
            return
          }

          await Promise.all([
            utils.liveQuiz.running.invalidate(),
            utils.activity.liveQuizSummary.invalidate({
              activityId: quizId,
            }),
          ]).catch(console.error)
          const routed = await router.push('/activities')
          if (!routed)
            throw new Error('Live quiz cancellation navigation failed')
          onClose()
          setConfirmations({ ...initialConfirmations })
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
          setCancelPending(false)
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-cancel-live-quiz' }}
      secondaryLabel={t('shared.generic.close')}
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'abort-cancel-live-quiz' }}
      className={{ content: 'max-w-240' }}
    >
      {summaryUnavailable ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}

      {summary ? (
        <LiveQuizAbortionConfirmations
          summary={summary}
          confirmations={confirmations}
          setConfirmations={setConfirmations}
        />
      ) : null}
    </Modal>
  )
}

export default CancelLiveQuizModal
