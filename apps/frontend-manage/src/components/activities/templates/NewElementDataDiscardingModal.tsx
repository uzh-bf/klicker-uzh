import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faX } from '@fortawesome/free-solid-svg-icons'
import { Button, ModalLegacy } from '@uzh-bf/design-system'
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
    <ModalLegacy
      open={open}
      onClose={onClose}
      title={t('manage.template.discardEnteredElementContent')}
      data={{ cy: 'discard-new-edits-modal' }}
    >
      <div className="mb-4">
        {t('manage.template.confirmDiscardEnteredElementContent')}
      </div>
      <div className="mt-4 flex justify-between">
        <Button onClick={onClose} data={{ cy: 'cancel-discard-new-edits' }}>
          <Button.Icon icon={faX} />
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          primary
          onClick={onConfirm}
          data={{ cy: 'confirm-discard-new-edits' }}
        >
          <Button.Icon icon={faTrashCan} />
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      </div>
    </ModalLegacy>
  )
}

export default NewElementDataDiscardingModal
