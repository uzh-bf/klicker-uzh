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
      update: (cache, { data: res }) => {
        // if the microlearning is not part of a course or the mutation was not successful, return early
        if (!res?.deleteMicroLearning?.id) return

        // change the status of the microlearning on the course overview back to draft
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
                microLearningsInfo:
                  data.course.microLearningsInfo?.filter(
                    (ml) => ml.id !== res.deleteMicroLearning!.id
                  ) ?? [],
              },
            }
          }
        )
      },
    }
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
        await deleteMicroLearning()
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
