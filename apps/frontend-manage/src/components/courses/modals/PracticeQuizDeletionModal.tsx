import { useMutation, useQuery } from '@apollo/client'
import {
  DeletePracticeQuizDocument,
  GetPracticeQuizSummaryDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function PracticeQuizDeletionModal({
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
    GetPracticeQuizSummaryDocument,
    {
      variables: { id: activityId },
      skip: !open,
    }
  )

  const [deletePracticeQuiz, { loading: deletingPracticeQuiz }] = useMutation(
    DeletePracticeQuizDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        deletePracticeQuiz: {
          id: activityId,
          __typename: 'PracticeQuiz',
        },
      },
      // TODO: replace this with a more efficient cache update
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId } },
      ],
    }
  )

  const [confirmations, setConfirmations] = useState({
    deleteResponses: false,
    deleteAnonymousResponses: false,
  })

  useEffect(() => {
    if (summaryData?.getPracticeQuizSummary) {
      setConfirmations({
        deleteResponses:
          summaryData?.getPracticeQuizSummary.numOfResponses === 0,
        deleteAnonymousResponses:
          summaryData.getPracticeQuizSummary.numOfAnonymousResponses === 0,
      })
    }
  }, [summaryData?.getPracticeQuizSummary])

  if (!summaryData?.getPracticeQuizSummary) return null

  const summary = summaryData.getPracticeQuizSummary

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.deletePracticeQuiz')}
      message={t('manage.course.deletePracticeQuizMessage')}
      onSubmit={async () => {
        await deletePracticeQuiz()
        await refetchActivities?.()
      }}
      submitting={deletingPracticeQuiz}
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

export default PracticeQuizDeletionModal
