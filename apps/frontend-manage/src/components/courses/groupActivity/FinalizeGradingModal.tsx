import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

function FinalizeGradingModal({
  onClose,
  activityId,
}: {
  onClose: () => void
  activityId: string
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const finalizeGroupActivityGrading =
    trpc.activity.finalizeGroupActivityGrading.useMutation()

  return (
    <Modal
      open
      title={t('manage.groupActivity.finalizeGrading')}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={finalizeGroupActivityGrading.isLoading}
      primaryDisabled={finalizeGroupActivityGrading.isLoading}
      onPrimaryAction={async () => {
        try {
          const data = await finalizeGroupActivityGrading.mutateAsync({
            id: activityId,
          })

          if (data?.finalizeGroupActivityGrading?.id) {
            void utils.activity.groupActivityGrading
              .invalidate({
                id: activityId,
              })
              .catch(console.error)
            toast({
              type: 'success',
              message: t('manage.groupActivity.finalizeGradingSuccess'),
              options: { duration: 4000 },
            })
            onClose()
          } else {
            toast({
              type: 'error',
              message: t('manage.groupActivity.finalizeGradingError'),
              options: { duration: 6000 },
            })
            onClose()
          }
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('manage.groupActivity.finalizeGradingError'),
            options: { duration: 6000 },
          })
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-finalize-grading' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-finalize-grading' }}
      onClose={onClose}
      hideCloseButton={true}
      className={{ content: 'max-w-xl' }}
    >
      <div className="flex flex-row items-center gap-4">
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          size="xl"
          className="text-orange-600"
        />
        <div className="text-base">
          {t('manage.groupActivity.confirmFinalizeGrading')}
        </div>
      </div>
    </Modal>
  )
}

export default FinalizeGradingModal
