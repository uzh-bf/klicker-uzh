import { faFlagCheckered, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CloseBlockConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

function CloseBlockConfirmDialog({
  open,
  onClose,
  onConfirm,
}: CloseBlockConfirmDialogProps) {
  const t = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.cockpit.confirmCloseBlockTitle')}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faX} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-close-block' }}
      primaryButtonStyle="primary"
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faFlagCheckered} />
          <span>{t('shared.generic.confirm')}</span>
        </div>
      }
      onPrimaryAction={async () => {
        await onConfirm()
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-close-block' }}
      className={{ content: 'max-w-lg' }}
    >
      <div className="mb-2 text-sm">
        {t('manage.cockpit.confirmCloseBlock')}
      </div>
    </Modal>
  )
}

export default CloseBlockConfirmDialog
