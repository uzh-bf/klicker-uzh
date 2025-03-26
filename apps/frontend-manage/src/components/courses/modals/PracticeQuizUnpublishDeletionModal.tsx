import { useMutation, useQuery } from '@apollo/client'
import {
  DeletePracticeQuizDocument,
  GetPracticeQuizSummaryDocument,
  GetSingleCourseDocument,
  UnpublishPracticeQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface PracticeQuizUnpublishDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
  unpublishingMode: boolean
}

function PracticeQuizUnpublishDeletionModal({
  open,
  setOpen,
  activityId,
  courseId,
  unpublishingMode,
}: PracticeQuizUnpublishDeletionModalProps) {
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
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId } },
      ],
    }
  )

  const [unpublishPracticeQuiz, { loading: unpublishingPracticeQuiz }] =
    useMutation(UnpublishPracticeQuizDocument, {
      variables: { id: activityId, deleteResponses: true },
      // TODO: add optimistic response and update cache
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId: courseId } },
      ],
    })

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
      open={open}
      setOpen={setOpen}
      title={
        unpublishingMode
          ? t('manage.course.unpublishPracticeQuiz')
          : t('manage.course.deletePracticeQuiz')
      }
      message={
        unpublishingMode
          ? t('manage.course.unpublishPracticeQuizMessage')
          : t('manage.course.deletePracticeQuizMessage')
      }
      onSubmit={async () => {
        if (unpublishingMode) {
          await unpublishPracticeQuiz()
        } else {
          await deletePracticeQuiz()
        }
        setOpen(false)
      }}
      submitting={deletingPracticeQuiz || unpublishingPracticeQuiz}
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

export default PracticeQuizUnpublishDeletionModal
