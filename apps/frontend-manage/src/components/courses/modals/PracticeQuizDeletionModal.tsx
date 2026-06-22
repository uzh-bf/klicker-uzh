import { ActivityType } from '@klicker-uzh/types'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function PracticeQuizDeletionModal({
  onClose,
  activityId,
  courseId,
  refetchActivities,
}: {
  onClose: () => void
  activityId: string
  courseId: string
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const {
    data: summaryData,
    error: summaryError,
    isLoading: summaryLoading,
  } = trpc.activity.practiceQuizSummary.useQuery({ activityId })
  const deleteActivity = trpc.activity.delete.useMutation()

  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteAnonymousResponses: false,
  })

  useEffect(() => {
    if (summaryData?.practiceQuizSummary) {
      setConfirmations({
        deleteResponses: summaryData.practiceQuizSummary.numOfResponses === 0,
        deleteAnonymousResponses:
          summaryData.practiceQuizSummary.numOfAnonymousResponses === 0,
      })
    }
  }, [summaryData?.practiceQuizSummary])

  const summary = summaryData?.practiceQuizSummary
  if (!summary) {
    return (
      <ActivityConfirmationModal
        onClose={onClose}
        title={t('manage.course.deletePracticeQuiz')}
        message={t('manage.course.deletePracticeQuizMessage')}
        loading={summaryLoading}
        onSubmit={async () => undefined}
        submitting={false}
        confirmations={{ summaryLoaded: false }}
        confirmationsInitializing={summaryLoading}
        confirmationType="delete"
      >
        {!summaryLoading || summaryError ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}
      </ActivityConfirmationModal>
    )
  }

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.deletePracticeQuiz')}
      message={t('manage.course.deletePracticeQuizMessage')}
      onSubmit={async () => {
        const result = await deleteActivity.mutateAsync({
          activityId,
          activityType: ActivityType.PRACTICE_QUIZ,
        })
        if (!result.deleteActivity?.id) {
          throw new Error('Failed to delete practice quiz')
        }

        await Promise.all([
          utils.course.detail.invalidate({ courseId }),
          refetchActivities?.(),
        ]).catch(console.error)
      }}
      submitting={deleteActivity.isLoading}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading}
      confirmationType="delete"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          label={
            summary.numOfResponses === 0
              ? t('manage.course.noResponsesToDelete')
              : t('manage.course.deleteResponses', {
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
            summary.numOfAnonymousResponses === 0
              ? t('manage.course.noAnonymousResponsesToDelete')
              : t('manage.course.deleteAnonymousResponses', {
                  number: summary.numOfAnonymousResponses,
                })
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              deleteAnonymousResponses: true,
            }))
          }}
          confirmed={confirmations.deleteAnonymousResponses}
          notApplicable={summary.numOfAnonymousResponses === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-deletion-anonymous-responses' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default PracticeQuizDeletionModal
