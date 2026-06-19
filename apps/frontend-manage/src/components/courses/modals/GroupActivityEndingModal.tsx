import { useMutation, useQuery } from '@apollo/client'
import {
  EndGroupActivityDocument,
  GetGroupActivitySummaryDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
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
        const result = await endGroupActivity()
        if (result.data?.endGroupActivity?.id) {
          await utils.course.detail.invalidate({ courseId })
        }
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
