import { useMutation, useQuery } from '@apollo/client'
import {
  EndMicroLearningDocument,
  GetMicroLearningSummaryDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

interface MicroLearningEndingModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  courseId: string
}

function MicroLearningEndingModal({
  open,
  setOpen,
  activityId,
  courseId,
}: MicroLearningEndingModalProps) {
  const t = useTranslations()
  const {
    data: summaryData,
    loading: summaryLoading,
    refetch,
  } = useQuery(GetMicroLearningSummaryDocument, {
    variables: { id: activityId },
    skip: !open,
  })

  const [endMicroLearning, { loading: endingMicroLearning }] = useMutation(
    EndMicroLearningDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        endMicroLearning: {
          id: activityId,
          scheduledEndAt: new Date(),
          __typename: 'MicroLearning',
        },
      },
      update(cache, res) {
        const data = cache.readQuery({
          query: GetSingleCourseDocument,
          variables: { courseId },
        })

        if (!data?.course?.microLearnings || !res.data?.endMicroLearning) return

        cache.writeQuery({
          query: GetSingleCourseDocument,
          variables: { courseId },
          data: {
            course: {
              ...data.course,
              microLearnings: data.course.microLearnings.map((micro) =>
                micro.id === activityId
                  ? {
                      ...micro,
                      scheduledEndAt:
                        res.data?.endMicroLearning!.scheduledEndAt,
                    }
                  : micro
              ),
            },
          },
        })
      },
    }
  )

  // manually re-trigger the query when the modal is opened
  useEffect(() => {
    if (open) {
      refetch()
    }
  }, [open])

  if (!summaryData?.getMicroLearningSummary) return null
  const summary = summaryData.getMicroLearningSummary

  return (
    <ActivityConfirmationModal
      open={open}
      setOpen={setOpen}
      title={t('manage.course.endMicroLearning')}
      message={t('manage.course.endMicroLearningMessage')}
      onSubmit={async () => await endMicroLearning()}
      submitting={endingMicroLearning}
      confirmations={{}}
      confirmationsInitializing={summaryLoading}
      confirmationType="confirm"
    >
      <div className="flex flex-col gap-2">
        <ConfirmationItem
          label={
            summary.numOfResponses === 0
              ? t('manage.course.noResponsesToMicroLearning')
              : t('manage.course.responsesToMicroLearning', {
                  number: summary.numOfResponses,
                })
          }
          onClick={() => null}
          confirmed={true}
          notApplicable={true}
          data={{ cy: 'confirm-responses-microlearning' }}
        />
        <ConfirmationItem
          label={
            summary.numOfAnonymousResponses === 0
              ? t('manage.course.noAnonResponsesToMicroLearning')
              : t('manage.course.anonResponsesToMicroLearning', {
                  number: summary.numOfAnonymousResponses,
                })
          }
          onClick={() => null}
          confirmed={true}
          notApplicable={true}
          confirmationType="confirm"
          data={{ cy: 'confirm-anonymous-responses-microlearning' }}
        />
      </div>
    </ActivityConfirmationModal>
  )
}

export default MicroLearningEndingModal
