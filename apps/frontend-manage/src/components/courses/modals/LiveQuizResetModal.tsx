import { useMutation, useQuery } from '@apollo/client'
import {
  GetLiveQuizSummaryDocument,
  GetSingleCourseDocument,
  ResetAssessmentLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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
  const { data: summaryData, loading: summaryLoading } = useQuery(
    GetLiveQuizSummaryDocument,
    { variables: { quizId }, fetchPolicy: 'network-only' }
  )

  const [resetLiveQuiz, { loading: resetting }] = useMutation(
    ResetAssessmentLiveQuizDocument,
    {
      variables: { id: quizId },
      update(cache, { data }) {
        const updatedLiveQuiz = data?.resetAssessmentLiveQuiz
        if (!updatedLiveQuiz || !courseId) return

        cache.updateQuery(
          { query: GetSingleCourseDocument, variables: { courseId } },
          (qData) => {
            if (!qData?.course?.liveQuizzesInfo) return qData
            return {
              course: {
                ...qData.course,
                liveQuizzesInfo: qData.course.liveQuizzesInfo.map((lq) =>
                  lq.id === updatedLiveQuiz.id ? updatedLiveQuiz : lq
                ),
              },
            }
          }
        )
      },
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
        deleteResponses: summaryData.getLiveQuizSummary.numOfResponses === 0,
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
      onClose={onClose}
      title={t('manage.liveQuizzes.resetLiveQuiz')}
      message={t('manage.liveQuizzes.resetLiveQuizMessage')}
      onSubmit={async () => {
        await resetLiveQuiz()
        await onSuccess?.()
      }}
      submitting={resetting}
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
