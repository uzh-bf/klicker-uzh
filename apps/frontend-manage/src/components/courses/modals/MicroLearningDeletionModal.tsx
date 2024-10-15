import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteMicroLearningDocument,
  GetMicroLearningSummaryDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface MicroLearningDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
}

function MicroLearningDeletionModal({
  open,
  setOpen,
  activityId,
  courseId,
}: MicroLearningDeletionModalProps) {
  const t = useTranslations()
  const {
    data: summaryData,
    loading: summaryLoading,
    refetch,
  } = useQuery(GetMicroLearningSummaryDocument, {
    variables: { id: activityId },
    skip: !open,
  })

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

  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteAnonymousResponses: false,
  })

  // manually re-trigger the query when the modal is opened
  useEffect(() => {
    if (open) {
      refetch()
    }
  }, [open])

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
      title={t('manage.course.deleteMicroLearning')}
      message={t('manage.course.deleteMicroLearningMessage')}
      onSubmit={async () => await deleteMicroLearning()}
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
