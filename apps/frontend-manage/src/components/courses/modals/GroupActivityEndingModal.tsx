import { useMutation, useQuery } from '@apollo/client'
import {
  EndGroupActivityDocument,
  GetGroupActivitySummaryDocument,
  GetSingleCourseDocument,
  GroupActivityStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface GroupActivityEndingModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
}

function GroupActivityEndingModal({
  open,
  setOpen,
  activityId,
  courseId,
}: GroupActivityEndingModalProps) {
  const t = useTranslations()
  const {
    data: summaryData,
    loading: summaryLoading,
    refetch,
  } = useQuery(GetGroupActivitySummaryDocument, {
    variables: { id: activityId },
    skip: !open,
  })

  const [endGroupActivity, { loading: endingGroupActivity }] = useMutation(
    EndGroupActivityDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        endGroupActivity: {
          id: activityId,
          status: GroupActivityStatus.Ended,
          __typename: 'GroupActivity',
        },
      },
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId } },
      ],
    }
  )

  const [confirmations, setConfirmations] = useState({
    startedInstances: false,
    submissions: true,
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
      open={open}
      setOpen={setOpen}
      title={t('manage.course.endGroupActivity')}
      message={t('manage.course.endGroupActivityMessage')}
      onSubmit={async () => await endGroupActivity()}
      submitting={endingGroupActivity}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading}
      confirmationType="confirm"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          label={
            summary.numOfStartedInstances === 0
              ? t('manage.course.noStartedInstancesLoosingAccess')
              : t('manage.course.startedInstancesLoosingAccess', {
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
          data={{ cy: 'confirm-deletion-started-instances' }}
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
          data={{ cy: 'confirm-deletion-submissions' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default GroupActivityEndingModal
