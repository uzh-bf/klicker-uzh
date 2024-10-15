import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteGroupActivityDocument,
  GetGroupActivitySummaryDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface GroupActivityConfirmationModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
}

function GroupActivityConfirmationModal({
  open,
  setOpen,
  activityId,
  courseId,
}: GroupActivityConfirmationModalProps) {
  const t = useTranslations()
  const {
    data: summaryData,
    loading: summaryLoading,
    refetch,
  } = useQuery(GetGroupActivitySummaryDocument, {
    variables: { id: activityId },
    skip: !open,
  })

  const [deleteGroupActivity, { loading: deletingGroupActivity }] = useMutation(
    DeleteGroupActivityDocument,
    {
      variables: {
        id: activityId,
      },
      optimisticResponse: {
        __typename: 'Mutation',
        deleteGroupActivity: {
          __typename: 'GroupActivity',
          id: activityId,
        },
      },
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId } },
      ],
    }
  )

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
    <ActivityConfirmationModal
      open={open}
      setOpen={setOpen}
      title={t('manage.course.deleteGroupActivity')}
      message={t('manage.course.deleteGroupActivityMessage')}
      onSubmit={async () => await deleteGroupActivity()}
      submitting={deletingGroupActivity}
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

export default GroupActivityConfirmationModal
