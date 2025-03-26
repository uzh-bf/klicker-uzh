import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteMicroLearningDocument,
  GetMicroLearningSummaryDocument,
  GetSingleCourseDocument,
  UnpublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface MicroLearningUnpublishDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
  unpublishingMode: boolean
}

function MicroLearningUnpublishDeletionModal({
  open,
  setOpen,
  activityId,
  courseId,
  unpublishingMode,
}: MicroLearningUnpublishDeletionModalProps) {
  const t = useTranslations()
  const { data: summaryData, loading: summaryLoading } = useQuery(
    GetMicroLearningSummaryDocument,
    {
      variables: { id: activityId },
      skip: !open,
    }
  )

  const [deleteMicroLearning, { loading: deletingMicroLearning }] = useMutation(
    DeleteMicroLearningDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        deleteMicroLearning: {
          __typename: 'MicroLearning',
          id: activityId,
        },
      },
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId } },
      ],
    }
  )

  const [unpublishMicroLearning, { loading: unpublishingMicroLearning }] =
    useMutation(UnpublishMicroLearningDocument, {
      variables: { id: activityId, deleteResponses: true },
      // TODO: add optimistic response and update cache
    })

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
      open={open}
      setOpen={setOpen}
      title={
        unpublishingMode
          ? t('manage.course.unpublishMicroLearning')
          : t('manage.course.deleteMicroLearning')
      }
      message={
        unpublishingMode
          ? t('manage.course.unpublishMicroLearningMessage')
          : t('manage.course.deleteMicroLearningMessage')
      }
      onSubmit={async () => {
        if (unpublishingMode) {
          await unpublishMicroLearning()
        } else {
          await deleteMicroLearning()
        }
      }}
      submitting={deletingMicroLearning || unpublishingMicroLearning}
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

export default MicroLearningUnpublishDeletionModal
