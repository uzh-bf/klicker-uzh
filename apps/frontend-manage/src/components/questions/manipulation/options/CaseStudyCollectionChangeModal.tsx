import { Modal } from '@uzh-bf/design-system'
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
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      onPrimaryAction={() => {
        onConfirm()
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-change-collection' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-change-collection' }}
      className={{ content: 'max-w-lg' }}
    >
      <div>{t('manage.elements.confirmCollectionChange')}</div>
    </Modal>
  )
}

export default CaseStudyCollectionChangeModal
