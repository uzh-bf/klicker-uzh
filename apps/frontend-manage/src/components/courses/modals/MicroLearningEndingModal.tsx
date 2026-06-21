import { ActivityType } from '@klicker-uzh/types'
import { UserNotification } from '@uzh-bf/design-system'
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
  const {
    data: summaryData,
    error: summaryError,
    isLoading: summaryLoading,
  } = trpc.activity.microLearningSummary.useQuery({ activityId })
  const endActivity = trpc.activity.end.useMutation()

  const summary = summaryData?.microLearningSummary
  if (!summary) {
    return (
      <ActivityConfirmationModal
        onClose={onClose}
        title={t('manage.course.endMicroLearning')}
        message={t('manage.course.endMicroLearningMessage')}
        loading={summaryLoading}
        onSubmit={async () => undefined}
        submitting={false}
        confirmations={{ summaryLoaded: false }}
        confirmationsInitializing={summaryLoading}
        confirmationType="confirm"
      >
        {!summaryLoading || summaryError ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}
      </ActivityConfirmationModal>
    )
  }

  return (
    <ActivityConfirmationModal
      onClose={onClose}
      title={t('manage.course.endMicroLearning')}
      message={t('manage.course.endMicroLearningMessage')}
      onSubmit={async () => {
        const result = await endActivity.mutateAsync({
          activityId,
          activityType: ActivityType.MICRO_LEARNING,
        })
        if (!result.endActivity?.id) {
          throw new Error('Failed to end microlearning')
        }

        void Promise.all([
          utils.course.detail.invalidate({ courseId }),
          refetchActivities?.(),
        ]).catch(console.error)
      }}
      submitting={endActivity.isLoading}
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
