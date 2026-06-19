import { ActivityType } from '@klicker-uzh/types'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function GroupActivityDeletionModal({
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
  const { data: summaryData, isLoading: summaryLoading } =
    trpc.activity.groupActivitySummary.useQuery({ activityId })
  const deleteActivity = trpc.activity.delete.useMutation()

  const [confirmations, setConfirmations] = useState({
    deleteStartedInstances: false,
    deleteSubmissions: false,
  })

  useEffect(() => {
    if (summaryData?.groupActivitySummary) {
      setConfirmations({
        deleteStartedInstances:
          summaryData.groupActivitySummary.numOfStartedInstances === 0,
        deleteSubmissions:
          summaryData.groupActivitySummary.numOfSubmissions === 0,
      })
    }
  }, [summaryData?.groupActivitySummary])

  if (!summaryData?.groupActivitySummary) return null

  const summary = summaryData.groupActivitySummary

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.deleteGroupActivity')}
      message={t('manage.course.deleteGroupActivityMessage')}
      onSubmit={async () => {
        const result = await deleteActivity.mutateAsync({
          activityId,
          activityType: ActivityType.GROUP_ACTIVITY,
        })
        if (result.deleteActivity?.id) {
          await utils.course.detail.invalidate({ courseId })
        }
        await refetchActivities?.()
      }}
      submitting={deleteActivity.isLoading}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading}
      confirmationType="delete"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          label={
            summary.numOfStartedInstances === 0
              ? t('manage.course.noStartedInstancesToDelete')
              : t('manage.course.deleteStartedInstance', {
                  number: summary.numOfStartedInstances,
                })
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              deleteStartedInstances: true,
            }))
          }}
          confirmed={confirmations.deleteStartedInstances}
          notApplicable={summary.numOfStartedInstances === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-deletion-started-instances' }}
        />
        <ConfirmationItem
          label={
            summary.numOfSubmissions === 0
              ? t('manage.course.noSubmissionsToDelete')
              : t('manage.course.deleteSubmissions', {
                  number: summary.numOfSubmissions,
                })
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              deleteSubmissions: true,
            }))
          }}
          confirmed={confirmations.deleteSubmissions}
          notApplicable={summary.numOfSubmissions === 0}
          confirmationType="delete"
          data={{ cy: 'confirm-deletion-submissions' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default GroupActivityDeletionModal
