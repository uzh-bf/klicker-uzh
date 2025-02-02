import { useQuery } from '@apollo/client'
import { GetLiveQuizSummaryDocument } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface LiveQuizDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  quizId: string
  onDelete: () => Promise<any>
  deleting: boolean
}

function LiveQuizDeletionModal({
  open,
  setOpen,
  quizId,
  onDelete,
  deleting,
}: LiveQuizDeletionModalProps) {
  const t = useTranslations()
  const { data: summaryData, loading: summaryLoading } = useQuery(
    GetLiveQuizSummaryDocument,
    {
      variables: { quizId },
      skip: !open,
    }
  )

  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteLeaderboardEntries: false,
    deleteFeedbacks: false, // Q&A channel
    deleteConfusionFeedbacks: false, // Confusion channel
  })

  useEffect(() => {
    if (summaryData?.getLiveQuizSummary) {
      setConfirmations({
        deleteResponses: summaryData?.getLiveQuizSummary.numOfResponses === 0,
        deleteLeaderboardEntries:
          summaryData.getLiveQuizSummary.numOfLeaderboardEntries === 0,
        deleteFeedbacks: summaryData.getLiveQuizSummary.numOfFeedbacks === 0,
        deleteConfusionFeedbacks:
          summaryData.getLiveQuizSummary.numOfConfusionFeedbacks === 0,
      })
    }
  }, [summaryData?.getLiveQuizSummary])

  if (!summaryData?.getLiveQuizSummary) return null

  const summary = summaryData.getLiveQuizSummary

  return (
    <ActivityConfirmationModal
      open={open}
      setOpen={setOpen}
      title={t('manage.liveQuizzes.deleteLiveQuiz')}
      message={t('manage.liveQuizzes.deleteLiveQuizMessage')}
      onSubmit={async () => await onDelete()}
      submitting={deleting}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading}
      confirmationType="delete"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          label={
            summary.numOfResponses === 0
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
          notApplicable={summary.numOfResponses === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-deletion-responses' }}
        />
        <ConfirmationItem
          label={
            summary.numOfFeedbacks === 0
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
          notApplicable={summary.numOfFeedbacks === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-deletion-qa-feedbacks' }}
        />
        <ConfirmationItem
          label={
            summary.numOfConfusionFeedbacks === 0
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
          notApplicable={summary.numOfConfusionFeedbacks === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-deletion-confusion-feedbacks' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default LiveQuizDeletionModal
