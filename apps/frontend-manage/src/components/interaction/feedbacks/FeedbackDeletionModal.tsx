import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface FeedbackDeletionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  feedbackContent: string
  loading?: boolean
}

function FeedbackDeletionModal({
  open,
  onClose,
  onConfirm,
  feedbackContent,
  loading = false,
}: FeedbackDeletionModalProps) {
  const t = useTranslations()

  const truncatedContent =
    feedbackContent.length > 50
      ? `${feedbackContent.substring(0, 50)}...`
      : feedbackContent

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.cockpit.deleteFeedback')}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faX} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-feedback-deletion' }}
      primaryButtonStyle="destructive"
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faTrashCan} />
          <span>{t('shared.generic.confirm')}</span>
        </div>
      }
      primaryLoading={loading}
      onPrimaryAction={async () => {
        await onConfirm()
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-feedback-deletion' }}
      data={{ cy: 'feedback-deletion-modal' }}
      className={{ content: 'max-w-xl' }}
    >
      <div className="space-y-2">
        <div className="text-base">
          {t('manage.cockpit.deleteFeedbackMessage', {
            feedback: truncatedContent,
          })}
        </div>
        <div className="text-sm text-gray-600">
          {t('manage.cockpit.moderationTipMessage')}
        </div>
      </div>
    </Modal>
  )
}

export default FeedbackDeletionModal
