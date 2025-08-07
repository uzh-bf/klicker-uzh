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
  const { data: summaryData, loading: summaryLoading } = useQuery(
    GetGroupActivitySummaryDocument,
    {
      variables: { id: activityId },
      skip: !open,
    }
  )

  const [deleteGroupActivity, { loading: deletingGroupActivity }] = useMutation(
    DeleteGroupActivityDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        deleteGroupActivity: {
          __typename: 'GroupActivity',
          id: activityId,
        },
      },
      update: (cache, { data: res }) => {
        // if the group activity is not part of a course or the mutation was not successful, return early
        if (!res?.deleteGroupActivity?.id) return

        // change the status of the group activity on the course overview back to draft
        cache.updateQuery(
          {
            query: GetSingleCourseDocument,
            variables: { courseId },
          },
          (data) => {
            if (!data?.course) return data

            return {
              course: {
                ...data.course,
                groupActivitiesInfo:
                  data.course.groupActivitiesInfo?.filter(
                    (ga) => ga.id !== res.deleteGroupActivity!.id
                  ) ?? [],
              },
            }
          }
        )
      },
    }
  )

  const [confirmations, setConfirmations] = useState({
    deleteStartedInstances: false,
    deleteSubmissions: false,
  })

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
      onClose={onClose}
      title={t('manage.course.deleteGroupActivity')}
      message={t('manage.course.deleteGroupActivityMessage')}
      onSubmit={async () => {
        await deleteGroupActivity()
        await refetchActivities?.()
      }}
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

export default GroupActivityDeletionModal
