import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function NewElementDataDiscardingModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.template.discardEnteredElementContent')}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faX} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-discard-new-edits' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faTrashCan} />
          <span>{t('shared.generic.confirm')}</span>
        </div>
      }
      onPrimaryAction={onConfirm}
      dataPrimaryAction={{ cy: 'confirm-discard-new-edits' }}
      data={{ cy: 'discard-new-edits-modal' }}
    >
      <div className="mb-4">
        {t('manage.template.confirmDiscardEnteredElementContent')}
      </div>
    </Modal>
  )
}

export default NewElementDataDiscardingModal
