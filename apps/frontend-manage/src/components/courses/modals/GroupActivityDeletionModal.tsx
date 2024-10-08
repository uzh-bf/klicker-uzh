import { useQuery } from '@apollo/client'
import DeletionItem from '@components/common/DeletionItem'
import { GetGroupActivitySummaryDocument } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ActivityDeletionModal from './ActivityDeletionModal'

interface GroupActivityDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
}

function GroupActivityDeletionModal({
  open,
  setOpen,
  activityId,
  courseId,
}: GroupActivityDeletionModalProps) {
  const t = useTranslations()
  const {
    data: summaryData,
    loading: summaryLoading,
    refetch,
  } = useQuery(GetGroupActivitySummaryDocument, {
    variables: { id: activityId },
    skip: !open,
  })

  const [confirmations, setConfirmations] = useState({
    deleteStartedInstances: false,
    deleteSubmissions: false,
  })

  // manually re-trigger the query when the modal is opened
  useEffect(() => {
    if (open) {
      refetch()
    }
  }, [open])

  useEffect(() => {
    if (summaryData?.getGroupActivitySummary) {
      setConfirmations({
        deleteStartedInstances:
          summaryData?.getGroupActivitySummary.numOfStartedInstances === 0,
        deleteSubmissions:
          summaryData.getGroupActivitySummary.numOfSubmissions === 0,
      })
    }
  }, [summaryData?.getGroupActivitySummary])

  if (!summaryData?.getGroupActivitySummary) return null

  const summary = summaryData.getGroupActivitySummary

  return (
    <ActivityDeletionModal
      open={open}
      setOpen={setOpen}
      title={t('manage.course.deleteGroupActivity')}
      message={t('manage.course.deleteGroupActivityMessage')}
      activityId={activityId}
      activityType="GroupActivity"
      courseId={courseId}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading}
    >
      <div className="flex flex-col gap-2">
        <DeletionItem
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
          data={{ cy: 'confirm-deletion-started-instances' }}
        />
        <DeletionItem
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
          data={{ cy: 'confirm-deletion-submissions' }}
        />
      </div>
    </ActivityDeletionModal>
  )
}

export default GroupActivityDeletionModal
