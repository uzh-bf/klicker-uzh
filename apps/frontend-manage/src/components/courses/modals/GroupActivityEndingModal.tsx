import { ActivityType } from '@klicker-uzh/types'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function GroupActivityEndingModal({
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
  const endActivity = trpc.activity.end.useMutation()

  const [confirmations, setConfirmations] = useState({
    startedInstances: false,
    submissions: true,
  })

  useEffect(() => {
    if (summaryData?.groupActivitySummary) {
      setConfirmations({
        startedInstances:
          summaryData.groupActivitySummary.numOfStartedInstances === 0,
        submissions: true,
      })
    }
  }, [summaryData?.groupActivitySummary])

  if (!summaryData?.groupActivitySummary) return null
  const summary = summaryData.groupActivitySummary

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.endGroupActivity')}
      message={t('manage.course.endGroupActivityMessage')}
      onSubmit={async () => {
        const result = await endActivity.mutateAsync({
          activityId,
          activityType: ActivityType.GROUP_ACTIVITY,
        })
        if (!result.endActivity?.id) {
          throw new Error('Failed to end group activity')
        }

        void Promise.all([
          utils.course.detail.invalidate({ courseId }),
          refetchActivities?.(),
        ]).catch(console.error)
      }}
      submitting={endActivity.isLoading}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading}
      confirmationType="confirm"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          label={
            summary.numOfStartedInstances === 0
              ? t('manage.course.noStartedInstancesLosingAccess')
              : t('manage.course.startedInstancesLosingAccess', {
                  number: summary.numOfStartedInstances,
                })
          }
          onClick={() => {
            setConfirmations((prev) => ({
              ...prev,
              startedInstances: true,
            }))
          }}
          confirmed={confirmations.startedInstances}
          notApplicable={summary.numOfStartedInstances === 0}
          confirmationType="confirm"
          data={{ cy: 'confirm-instances-loosing-access' }}
        />
        <ConfirmationItem
          label={
            summary.numOfSubmissions === 0
              ? t('manage.course.noSubmissionsToActivity')
              : t('manage.course.unaffectedSubmissions', {
                  number: summary.numOfSubmissions,
                })
          }
          onClick={() => null}
          confirmed={confirmations.submissions}
          notApplicable={true}
          confirmationType="confirm"
          data={{ cy: 'confirm-successful-submissions' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default GroupActivityEndingModal
