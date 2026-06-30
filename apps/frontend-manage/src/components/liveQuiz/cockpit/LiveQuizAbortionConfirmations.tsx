import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import { LiveQuizAbortionConfirmationType } from './CancelLiveQuizModal'

type LiveQuizSummary = {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
}

interface LiveQuizAbortionConfirmationsProps {
  summary: LiveQuizSummary
  confirmations: LiveQuizAbortionConfirmationType
  setConfirmations: Dispatch<SetStateAction<LiveQuizAbortionConfirmationType>>
}

function LiveQuizAbortionConfirmations({
  summary,
  confirmations,
  setConfirmations,
}: LiveQuizAbortionConfirmationsProps) {
  const t = useTranslations()
  const confirmationData = (count: number, cy: string) =>
    count > 0 ? { cy } : undefined

  return (
    <div className="flex flex-col gap-2">
      <UserNotification
        type="warning"
        message={t('manage.cockpit.cancelLiveQuizMessage')}
        className={{ root: 'mb-1 text-base' }}
      />
      <ConfirmationItem
        label={
          summary.numOfResponses === 0
            ? t('manage.cockpit.noResponsesToDelete')
            : t('manage.cockpit.deleteResponses', {
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
        data={confirmationData(
          summary.numOfResponses,
          'lq-deletion-responses-confirm'
        )}
      />
      <ConfirmationItem
        label={
          summary.numOfFeedbacks === 0
            ? t('manage.cockpit.noFeedbacksToDelete')
            : t('manage.cockpit.deleteFeedbacks', {
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
        data={confirmationData(
          summary.numOfFeedbacks,
          'lq-deletion-feedbacks-confirm'
        )}
      />
      <ConfirmationItem
        label={
          summary.numOfConfusionFeedbacks === 0
            ? t('manage.cockpit.noConfusionFeedbacksToDelete')
            : t('manage.cockpit.deleteConfusionFeedbacks', {
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
        data={confirmationData(
          summary.numOfConfusionFeedbacks,
          'lq-deletion-confusion-feedbacks-confirm'
        )}
      />
      <ConfirmationItem
        label={
          summary.numOfLeaderboardEntries === 0
            ? t('manage.cockpit.noLeaderboardEntriesToDelete')
            : t('manage.cockpit.deleteLeaderboardEntries', {
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
        data={confirmationData(
          summary.numOfLeaderboardEntries,
          'lq-deletion-leaderboard-entries-confirm'
        )}
      />
    </div>
  )
}

export default LiveQuizAbortionConfirmations
