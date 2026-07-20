import { useMutation, useQuery } from '@apollo/client'
import {
  EndGroupActivityDocument,
  GetGroupActivitySummaryDocument,
  GetSingleCourseDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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
  const { data: summaryData, loading: summaryLoading } = useQuery(
    GetGroupActivitySummaryDocument,
    {
      variables: { id: activityId },
      skip: !open,
    }
  )

  const [endGroupActivity, { loading: endingGroupActivity }] = useMutation(
    EndGroupActivityDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        endGroupActivity: {
          id: activityId,
          status: PublicationStatus.Ended,
          scheduledEndAt: new Date(),
          __typename: 'GroupActivity',
        },
      },
      update(cache, { data }) {
        cache.updateQuery(
          { query: GetSingleCourseDocument, variables: { courseId } },
          (qData) => {
            const endedGa = data?.endGroupActivity
            if (!qData?.course?.groupActivitiesInfo || !endedGa) return qData

            return {
              course: {
                ...qData.course,
                groupActivitiesInfo: qData.course.groupActivitiesInfo.map(
                  (groupActivity) =>
                    groupActivity.id === endedGa.id
                      ? {
                          ...groupActivity,
                          scheduledEndAt: endedGa.scheduledEndAt,
                          status: endedGa.status,
                        }
                      : groupActivity
                ),
              },
            }
          }
        )
      },
    }
  )

  const [confirmations, setConfirmations] = useState({
    startedInstances: false,
    submissions: true,
  })

  useEffect(() => {
    if (summaryData?.getGroupActivitySummary) {
      setConfirmations({
        startedInstances:
          summaryData?.getGroupActivitySummary.numOfStartedInstances === 0,
        submissions: true,
      })
    }
  }, [summaryData?.getGroupActivitySummary])

  if (!summaryData?.getGroupActivitySummary) return null
  const summary = summaryData.getGroupActivitySummary

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.endGroupActivity')}
      message={t('manage.course.endGroupActivityMessage')}
      onSubmit={async () => {
        await endGroupActivity()
        await refetchActivities?.()
      }}
      submitting={endingGroupActivity}
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
