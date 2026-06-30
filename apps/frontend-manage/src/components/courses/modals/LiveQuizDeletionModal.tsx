import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function LiveQuizDeletionModal({
  onClose,
  quizId,
  onDelete,
  deleting,
}: {
  onClose: () => void
  quizId: string
  onDelete: () => Promise<any>
  deleting: boolean
}) {
  const t = useTranslations()
  const {
    data: summaryData,
    error: summaryError,
    isLoading: summaryLoading,
  } = trpc.activity.liveQuizSummary.useQuery({ activityId: quizId })

  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteLeaderboardEntries: false,
    deleteFeedbacks: false, // Q&A channel
    deleteConfusionFeedbacks: false, // Confusion channel
  })

  useEffect(() => {
    const liveQuizSummary = summaryData?.liveQuizSummary
    if (!liveQuizSummary) return

    setConfirmations((prev) => ({
      deleteResponses:
        prev.deleteResponses || liveQuizSummary.numOfResponses === 0,
      deleteLeaderboardEntries:
        prev.deleteLeaderboardEntries ||
        liveQuizSummary.numOfLeaderboardEntries === 0,
      deleteFeedbacks:
        prev.deleteFeedbacks || liveQuizSummary.numOfFeedbacks === 0,
      deleteConfusionFeedbacks:
        prev.deleteConfusionFeedbacks ||
        liveQuizSummary.numOfConfusionFeedbacks === 0,
    }))
  }, [summaryData?.liveQuizSummary])

  const summary = summaryData?.liveQuizSummary
  const summaryUnavailable = !summary
  const loadingLabel = t('shared.generic.loading')
  const confirmationData = (count: number | undefined, cy: string) =>
    (count ?? 0) > 0 ? { cy } : undefined

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.liveQuizzes.deleteLiveQuiz')}
      message={t('manage.liveQuizzes.deleteLiveQuizMessage')}
      onSubmit={async () => {
        if (summaryUnavailable) return
        await onDelete()
      }}
      submitting={deleting}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading || summaryUnavailable}
      confirmationType="delete"
    >
      <div className="flex flex-col gap-2">
        {summaryError ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}
        <ConfirmationItem
          label={
            summaryUnavailable
              ? `${t('manage.liveQuizzes.deleteResponses', {
                  number: 0,
                })} ${loadingLabel}`
              : summary.numOfResponses === 0
                ? t('manage.liveQuizzes.noResponsesToDelete')
                : t('manage.liveQuizzes.deleteResponses', {
                    number: summary.numOfResponses,
                  })
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              deleteResponses: true,
            }))
          }}
          confirmed={confirmations.deleteResponses}
          notApplicable={summary?.numOfResponses === 0}
          confirmationType="delete"
          data={confirmationData(
            summary?.numOfResponses,
            'confirm-deletion-responses'
          )}
        />
        <ConfirmationItem
          label={
            summaryUnavailable
              ? loadingLabel
              : summary.numOfFeedbacks === 0
                ? t('manage.liveQuizzes.noFeedbacksToDelete')
                : t('manage.liveQuizzes.deleteFeedbacks', {
                    number: summary.numOfFeedbacks,
                  })
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              deleteFeedbacks: true,
            }))
          }}
          confirmed={confirmations.deleteFeedbacks}
          notApplicable={summary?.numOfFeedbacks === 0}
          confirmationType="delete"
          data={confirmationData(
            summary?.numOfFeedbacks,
            'confirm-deletion-qa-feedbacks'
          )}
          disabled={summaryUnavailable}
        />
        <ConfirmationItem
          label={
            summaryUnavailable
              ? loadingLabel
              : summary.numOfConfusionFeedbacks === 0
                ? t('manage.liveQuizzes.noConfusionFeedbacksToDelete')
                : t('manage.liveQuizzes.deleteConfusionFeedbacks', {
                    number: summary.numOfConfusionFeedbacks,
                  })
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              deleteConfusionFeedbacks: true,
            }))
          }}
          confirmed={confirmations.deleteConfusionFeedbacks}
          notApplicable={summary?.numOfConfusionFeedbacks === 0}
          confirmationType="delete"
          data={confirmationData(
            summary?.numOfConfusionFeedbacks,
            'confirm-deletion-confusion-feedbacks'
          )}
          disabled={summaryUnavailable}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default LiveQuizDeletionModal
