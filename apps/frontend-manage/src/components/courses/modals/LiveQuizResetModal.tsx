import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function LiveQuizResetModal({
  quizId,
  isGamificationEnabled,
  onSuccess,
  onClose,
  courseId,
}: {
  quizId: string
  isGamificationEnabled?: boolean | null
  onSuccess?: () => Promise<void> | void
  onClose: () => void
  courseId?: string | null
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const { data: summaryData, isLoading: summaryLoading } =
    trpc.activity.liveQuizSummary.useQuery({ activityId: quizId })
  const resetLiveQuiz = trpc.activity.resetAssessmentLiveQuiz.useMutation()

  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteLeaderboardEntries: false,
    deleteFeedbacks: false, // Q&A channel
    deleteConfusionFeedbacks: false, // Confusion channel
  })

  useEffect(() => {
    if (summaryData?.liveQuizSummary) {
      setConfirmations({
        deleteResponses: summaryData.liveQuizSummary.numOfResponses === 0,
        deleteLeaderboardEntries:
          summaryData.liveQuizSummary.numOfLeaderboardEntries === 0,
        deleteFeedbacks: summaryData.liveQuizSummary.numOfFeedbacks === 0,
        deleteConfusionFeedbacks:
          summaryData.liveQuizSummary.numOfConfusionFeedbacks === 0,
      })
    }
  }, [summaryData?.liveQuizSummary])

  if (!summaryData?.liveQuizSummary) return null
  const summary = summaryData.liveQuizSummary

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.liveQuizzes.resetLiveQuiz')}
      message={t('manage.liveQuizzes.resetLiveQuizMessage')}
      onSubmit={async () => {
        const result = await resetLiveQuiz.mutateAsync({ activityId: quizId })
        if (!result.resetAssessmentLiveQuiz?.id) {
          throw new Error('Failed to reset live quiz')
        }

        void Promise.all([
          courseId
            ? utils.course.detail.invalidate({ courseId })
            : Promise.resolve(),
          onSuccess?.(),
        ]).catch(console.error)
      }}
      submitting={resetLiveQuiz.isLoading}
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
            setConfirmations((prev) => ({ ...prev, deleteResponses: true }))
          }}
          confirmed={confirmations.deleteResponses}
          notApplicable={summary.numOfResponses === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-reset-responses' }}
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
            setConfirmations((prev) => ({ ...prev, deleteFeedbacks: true }))
          }}
          confirmed={confirmations.deleteFeedbacks}
          notApplicable={summary.numOfFeedbacks === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-reset-qa-feedbacks' }}
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
          data={{ cy: 'confirm-reset-confusion-feedbacks' }}
        />
        {isGamificationEnabled && (
          <ConfirmationItem
            label={
              summary.numOfLeaderboardEntries === 0
                ? t('manage.liveQuizzes.noLeaderboardEntriesToDelete')
                : t('manage.liveQuizzes.deleteLeaderboardEntries', {
                    number: summary.numOfLeaderboardEntries,
                  })
            }
            onClick={() => {
              setConfirmations((prev) => ({
                ...prev,
                deleteLeaderboardEntries: true,
              }))
            }}
            confirmed={confirmations.deleteLeaderboardEntries}
            notApplicable={summary.numOfLeaderboardEntries === 0}
            confirmationType="delete"
            data={{ cy: 'confirm-reset-leaderboard-entries' }}
          />
        )}
      </div>
    </ActivityConfirmationModal>
  )
}

export default LiveQuizResetModal
