import { useQuery } from '@apollo/client'
import DeletionItem from '@components/common/DeletionItem'
import { GetPracticeQuizSummaryDocument } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ActivityDeletionModal from './ActivityDeletionModal'

interface PracticeQuizDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
}

function PracticeQuizDeletionModal({
  open,
  setOpen,
  activityId,
  courseId,
}: PracticeQuizDeletionModalProps) {
  const t = useTranslations()
  const {
    data: summaryData,
    loading: summaryLoading,
    refetch,
  } = useQuery(GetPracticeQuizSummaryDocument, {
    variables: { id: activityId },
    skip: !open,
  })

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
    <ActivityDeletionModal
      open={open}
      setOpen={setOpen}
      title={t('manage.course.deletePracticeQuiz')}
      message={t('manage.course.deletePracticeQuizMessage')}
      activityId={activityId}
      activityType="PracticeQuiz"
      courseId={courseId}
      confirmations={confirmations}
      confirmationsInitializing={summaryLoading}
    >
      <div className="flex flex-col gap-2">
        <DeletionItem
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
          data={{ cy: 'confirm-deletion-responses' }}
        />
        <DeletionItem
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
          data={{ cy: 'confirm-deletion-anonymous-responses' }}
        />
      </div>
    </ActivityDeletionModal>
  )
}

export default PracticeQuizDeletionModal
