import DeletionItem from '@components/common/DeletionItem'
import { RunningLiveQuizSummary } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { SessionAbortionConfirmationType } from './CancelSessionModal'

interface SessionAbortionConfirmationsProps {
  summary: RunningLiveQuizSummary
  confirmations: SessionAbortionConfirmationType
  setConfirmations: Dispatch<SetStateAction<SessionAbortionConfirmationType>>
}

function SessionAbortionConfirmations({
  summary,
  confirmations,
  setConfirmations,
}: SessionAbortionConfirmationsProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <UserNotification
        type="warning"
        message={t('manage.cockpit.cancelLiveQuizMessage')}
        className={{ root: 'mb-1 text-base' }}
      />
      <DeletionItem
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
        data={{ cy: 'lq-deletion-responses-confirm' }}
      />
      <DeletionItem
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
        data={{ cy: 'lq-deletion-feedbacks-confirm' }}
      />
      <DeletionItem
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
        data={{ cy: 'lq-deletion-confusion-feedbacks-confirm' }}
      />
      <DeletionItem
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
        data={{ cy: 'lq-deletion-leaderboard-entries-confirm' }}
      />
    </div>
  )
}

export default SessionAbortionConfirmations
