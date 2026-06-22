import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ActivityType } from '../../../lib/constants/activityEnums'
import { trpc, type RouterInputs } from '../../../lib/trpc'

interface TemplateDeletionModalProps {
  activityId: string
  activityType: ActivityType
  courseId?: string | null
  onClose: () => void
  onSuccess: () => void
  onError: () => void
  refetchActivities?: () => Promise<void>
}

function TemplateDeletionModal({
  activityId,
  activityType,
  onClose,
  onSuccess,
  onError,
  refetchActivities,
}: TemplateDeletionModalProps) {
  const t = useTranslations()
  const deleteActivityTemplate = trpc.activity.deleteTemplate.useMutation()
  const deleting = deleteActivityTemplate.isLoading
  const handleClose = () => {
    if (!deleting) {
      onClose()
    }
  }

  return (
    <Modal
      open
      title={t('manage.template.deleteTemplate')}
      onClose={handleClose}
      data={{ cy: 'delete-template-modal' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          {!deleting && <FontAwesomeIcon icon={faTrashCan} />}
          <span>{t('manage.template.deleteTemplate')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      primaryLoading={deleting}
      primaryDisabled={deleting}
      onPrimaryAction={async () => {
        try {
          const data = await deleteActivityTemplate.mutateAsync({
            activityId,
            activityType:
              activityType as RouterInputs['activity']['deleteTemplate']['activityType'],
          })

          if (data?.deleteActivityTemplate) {
            await refetchActivities?.().catch(console.error)
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
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-deletion' }}
      className={{ content: 'max-w-xl' }}
    >
      {t('manage.template.deleteTemplateExplanation')}
    </Modal>
  )
}

export default TemplateDeletionModal
