import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteMicroLearningDocument,
  GetMicroLearningSummaryDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function MicroLearningDeletionModal({
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
    GetMicroLearningSummaryDocument,
    {
      variables: { id: activityId },
      skip: !open,
    }
  )

  const [deleteMicroLearning, { loading: deletingMicroLearning }] = useMutation(
    DeleteMicroLearningDocument,
    { variables: { id: activityId } }
  )

  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteAnonymousResponses: false,
  })

  useEffect(() => {
    if (summaryData?.getMicroLearningSummary) {
      setConfirmations({
        deleteResponses:
          summaryData?.getMicroLearningSummary.numOfResponses === 0,
        deleteAnonymousResponses:
          summaryData.getMicroLearningSummary.numOfAnonymousResponses === 0,
      })
    }
  }, [summaryData?.getMicroLearningSummary])

  if (!summaryData?.getMicroLearningSummary) return null

  const summary = summaryData.getMicroLearningSummary

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.deleteMicroLearning')}
      message={t('manage.course.deleteMicroLearningMessage')}
      onSubmit={async () => {
        const result = await deleteMicroLearning()
        if (result.data?.deleteMicroLearning?.id) {
          await utils.course.detail.invalidate({ courseId })
        }
        await refetchActivities?.()
      }}
      submitting={deletingMicroLearning}
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

export default MicroLearningDeletionModal
