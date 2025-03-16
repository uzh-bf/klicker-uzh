import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faX } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal } from '@uzh-bf/design-system'
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
    >
      <div className="mb-4">
        {t('manage.template.confirmDiscardEnteredElementContent')}
      </div>
      <div className="mt-4 flex justify-between">
        <Button onClick={onClose}>
          <Button.Icon icon={faX} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button primary onClick={onConfirm}>
          <Button.Icon icon={faTrashCan} />
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default NewElementDataDiscardingModal
