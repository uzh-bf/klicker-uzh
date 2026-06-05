import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { ActivityType as ApiActivityType } from '@klicker-uzh/types'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

interface TemplateDeletionModalProps {
  activityId: string
  activityType: ActivityType
  courseId?: string | null
  onClose: () => void
  onSuccess: () => void
  onError: () => void
  refetchActivities?: () => Promise<void>
}

const trpcActivityTypeByGraphqlActivityType = {
  [ActivityType.GroupActivity]: ApiActivityType.GROUP_ACTIVITY,
  [ActivityType.LiveQuiz]: ApiActivityType.LIVE_QUIZ,
  [ActivityType.MicroLearning]: ApiActivityType.MICRO_LEARNING,
  [ActivityType.PracticeQuiz]: ApiActivityType.PRACTICE_QUIZ,
} satisfies Record<ActivityType, ApiActivityType>

function TemplateDeletionModal({
  activityId,
  activityType,
  onClose,
  onSuccess,
  onError,
  refetchActivities,
}: TemplateDeletionModalProps) {
  const t = useTranslations()
  const trpcActivityType = trpcActivityTypeByGraphqlActivityType[activityType]
  const deleteActivityTemplate = trpc.activity.deleteTemplate.useMutation()

  return (
    <Modal
      open
      title={t('manage.template.deleteTemplate')}
      onClose={onClose}
      data={{ cy: 'delete-template-modal' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!deleteActivityTemplate.isLoading && (
            <FontAwesomeIcon icon={faTrashCan} />
          )}
          <span>{t('manage.template.deleteTemplate')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={deleteActivityTemplate.isLoading}
      onPrimaryAction={async () => {
        try {
          const data = await deleteActivityTemplate.mutateAsync({
            activityId,
            activityType: trpcActivityType,
          })

          if (data?.deleteActivityTemplate) {
            await refetchActivities?.()
            onSuccess()
            onClose()
          } else {
            onError()
          }
        } catch (e) {
          console.error(e)
          onError()
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-template-deletion' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-deletion' }}
      className={{ content: 'max-w-xl' }}
    >
      {t('manage.template.deleteTemplateExplanation')}
    </Modal>
  )
}

export default TemplateDeletionModal
