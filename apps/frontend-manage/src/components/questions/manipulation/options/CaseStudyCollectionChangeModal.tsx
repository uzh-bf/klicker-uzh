import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CaseStudyCollectionChangeModal({
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
      title={t('manage.elements.changeOfAnswerCollection')}
    >
      <div className="flex flex-col gap-4">
        <div>{t('manage.elements.confirmCollectionChange')}</div>
        <div className="flex justify-between gap-2">
          <Button onClick={onClose} data={{ cy: 'cancel-change-collection' }}>
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            destructive
            onClick={() => {
              onConfirm()
              onClose()
            }}
            data={{ cy: 'confirm-change-collection' }}
          >
            <Button.Label>{t('shared.generic.confirm')}</Button.Label>
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CaseStudyCollectionChangeModal
