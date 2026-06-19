import { useMutation, useQuery } from '@apollo/client'
import {
  EndMicroLearningDocument,
  GetMicroLearningSummaryDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'
import ConfirmationItem from '../../common/ConfirmationItem'
import ActivityConfirmationModal from './ActivityConfirmationModal'

function MicroLearningEndingModal({
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

  const [endMicroLearning, { loading: endingMicroLearning }] = useMutation(
    EndMicroLearningDocument,
    {
      variables: { id: activityId },
      optimisticResponse: {
        __typename: 'Mutation',
        endMicroLearning: {
          id: activityId,
          status: PublicationStatus.Ended,
          scheduledEndAt: new Date(),
          __typename: 'MicroLearning',
        },
      },
    }
  )

  if (!summaryData?.getMicroLearningSummary) return null
  const summary = summaryData.getMicroLearningSummary

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.endMicroLearning')}
      message={t('manage.course.endMicroLearningMessage')}
      onSubmit={async () => {
        const result = await endMicroLearning()
        if (result.data?.endMicroLearning?.id) {
          await utils.course.detail.invalidate({ courseId })
        }
        await refetchActivities?.()
      }}
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
