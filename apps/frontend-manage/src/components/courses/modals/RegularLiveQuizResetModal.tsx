import { useMutation, useQuery } from '@apollo/client'
import {
  GetLiveQuizResetSummaryDocument,
  GetSingleCourseDocument,
  LiveQuizResetEligibilityReason,
  ResetLiveQuizDocument,
  ResetLiveQuizOutcome,
} from '@klicker-uzh/graphql/dist/ops'
import { toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function RegularLiveQuizResetModal({
  quizId,
  onSuccess,
  onClose,
  courseId,
}: {
  quizId: string
  onSuccess?: () => Promise<void> | void
  onClose: () => void
  courseId?: string | null
}) {
  const t = useTranslations()
  const {
    data: summaryData,
    loading: summaryLoading,
    error: summaryError,
  } = useQuery(GetLiveQuizResetSummaryDocument, {
    variables: { quizId },
    fetchPolicy: 'network-only',
  })

  const [resetLiveQuiz, { loading: resetting }] = useMutation(
    ResetLiveQuizDocument,
    {
      variables: { id: quizId },
      update(cache, { data }) {
        const result = data?.resetLiveQuiz
        const updatedLiveQuiz = result?.activity
        if (
          result?.outcome !== ResetLiveQuizOutcome.Success ||
          !updatedLiveQuiz ||
          !courseId
        ) {
          return
        }

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

  const [confirmations, setConfirmations] = useState({ deleteRunData: false })
  const [outcome, setOutcome] = useState<ResetLiveQuizOutcome | null>(null)
  const summary = summaryData?.getLiveQuizResetSummary
  const summaryUnavailable = !summaryLoading && !summary
  const errorMessage =
    outcome === ResetLiveQuizOutcome.InvalidState ||
    summary?.reason === LiveQuizResetEligibilityReason.InvalidState
      ? t('manage.liveQuizzes.resetInvalidState')
      : (summary != null && !summary.eligible) ||
          summaryError ||
          summaryUnavailable
        ? t('manage.liveQuizzes.resetOutcomeError')
        : null

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.liveQuizzes.resetLiveQuiz')}
      message={t('manage.liveQuizzes.resetRegularLiveQuizMessage')}
      loading={summaryLoading}
      onSubmit={async () => {
        setOutcome(null)
        try {
          const { data } = await resetLiveQuiz()
          const result = data?.resetLiveQuiz

          if (!result) {
            toast({
              type: 'error',
              message: t('manage.liveQuizzes.resetOutcomeError'),
              options: { duration: 4500 },
            })
            return false
          }
          if (result.outcome !== ResetLiveQuizOutcome.Success) {
            setOutcome(result.outcome)
            return false
          }
          if (!result.activity) {
            toast({
              type: 'error',
              message: t('manage.liveQuizzes.resetOutcomeError'),
              options: { duration: 4500 },
            })
            return false
          }
        } catch {
          toast({
            type: 'error',
            message: t('manage.liveQuizzes.resetOutcomeError'),
            options: { duration: 4500 },
          })
          return false
        }

        try {
          await onSuccess?.()
        } catch {
          // The reset succeeded and the Apollo cache was updated. A failed
          // optional refresh must not leave the destructive action retryable.
        }
        return true
      }}
      submitting={resetting}
      confirmations={confirmations}
      confirmationsInitializing={!summary}
      primaryDisabled={!summary?.eligible}
      confirmationType="delete"
    >
      <div className="flex flex-col gap-2">
        {errorMessage ? (
          <UserNotification type="error">{errorMessage}</UserNotification>
        ) : null}
        {summary ? (
          <>
            <ConfirmationItem
              label={t('manage.liveQuizzes.resetRegularRunData', {
                responses: summary.numOfResponses,
                feedbacks: summary.numOfFeedbacks,
                confusion: summary.numOfConfusionFeedbacks,
                leaderboard: summary.numOfLeaderboardEntries,
              })}
              onClick={() => setConfirmations({ deleteRunData: true })}
              confirmed={confirmations.deleteRunData}
              notApplicable={false}
              confirmationType="delete"
              data={{ cy: 'confirm-reset-run-data' }}
            />
            <div className="mt-2 text-sm text-gray-600">
              {t('manage.liveQuizzes.resetPreservedRewards')}
            </div>
          </>
        ) : null}
      </div>
    </ActivityConfirmationModal>
  )
}

export default RegularLiveQuizResetModal
