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
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function LiveQuizResetModal({
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

  const [outcome, setOutcome] = useState<ResetLiveQuizOutcome | null>(null)
  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteFeedbacks: false,
    deleteConfusionFeedbacks: false,
    reverseRewards: false,
  })

  const summary = summaryData?.getLiveQuizResetSummary
  const rewardsNotApplicable =
    summary != null &&
    summary.numOfLeaderboardEntries === 0 &&
    summary.coursePointsToReverse === 0 &&
    summary.xpToReverse === 0 &&
    summary.numOfTimelineChanges === 0 &&
    summary.numOfAchievementChanges === 0

  useEffect(() => {
    if (!summary) return

    setConfirmations({
      deleteResponses: summary.numOfResponses === 0,
      deleteFeedbacks: summary.numOfFeedbacks === 0,
      deleteConfusionFeedbacks: summary.numOfConfusionFeedbacks === 0,
      reverseRewards: rewardsNotApplicable,
    })
  }, [rewardsNotApplicable, summary])

  const blockedMessage =
    summary?.reason === LiveQuizResetEligibilityReason.RewardDataUnavailable
      ? t('manage.liveQuizzes.resetBlockedRewardData')
      : summary?.reason === LiveQuizResetEligibilityReason.InvalidState
        ? t('manage.liveQuizzes.resetInvalidState')
        : summary != null && !summary.eligible
          ? t('manage.liveQuizzes.resetOutcomeError')
          : null
  const outcomeMessage =
    outcome === ResetLiveQuizOutcome.RewardDataUnavailable
      ? t('manage.liveQuizzes.resetBlockedRewardData')
      : outcome === ResetLiveQuizOutcome.InvalidState
        ? t('manage.liveQuizzes.resetInvalidState')
        : outcome === ResetLiveQuizOutcome.Conflict
          ? t('manage.liveQuizzes.resetConflict')
          : null
  const summaryUnavailable = !summaryLoading && !summary
  const errorMessage =
    outcomeMessage ??
    blockedMessage ??
    (summaryError || summaryUnavailable
      ? t('manage.liveQuizzes.resetOutcomeError')
      : null)

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.liveQuizzes.resetLiveQuiz')}
      message={t('manage.liveQuizzes.resetLiveQuizMessage')}
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

          await onSuccess?.()
          return true
        } catch {
          toast({
            type: 'error',
            message: t('manage.liveQuizzes.resetOutcomeError'),
            options: { duration: 4500 },
          })
          return false
        }
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
                setConfirmations((prev) => ({
                  ...prev,
                  deleteFeedbacks: true,
                }))
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
            <ConfirmationItem
              label={
                rewardsNotApplicable
                  ? t('manage.liveQuizzes.noRewardsToReset')
                  : t('manage.liveQuizzes.resetRewards', {
                      points: summary.coursePointsToReverse,
                      xp: summary.xpToReverse,
                      timeline: summary.numOfTimelineChanges,
                      achievements: summary.numOfAchievementChanges,
                    })
              }
              onClick={() => {
                setConfirmations((prev) => ({
                  ...prev,
                  reverseRewards: true,
                }))
              }}
              confirmed={confirmations.reverseRewards}
              notApplicable={rewardsNotApplicable}
              confirmationType="delete"
              data={{ cy: 'confirm-reset-rewards' }}
            />
            <div className="mt-2 text-sm text-gray-600">
              {t('manage.liveQuizzes.resetPreservedData')}
            </div>
          </>
        ) : null}
      </div>
    </ActivityConfirmationModal>
  )
}

export default LiveQuizResetModal
