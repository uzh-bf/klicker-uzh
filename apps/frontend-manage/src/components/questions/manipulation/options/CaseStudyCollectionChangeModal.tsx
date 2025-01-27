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
      title={t('manage.questionForms.changeOfAnswerCollection')}
    >
      <div className="flex flex-col gap-4">
        <div>{t('manage.questionForms.confirmCollectionChange')}</div>
        <div className="flex justify-between gap-2">
          <Button onClick={onClose} data={{ cy: 'cancel-change-collection' }}>
            {t('shared.generic.cancel')}
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={{
              root: 'border-red-600 hover:border-red-600 hover:text-red-600',
            }}
            data={{ cy: 'confirm-change-collection' }}
          >
            {t('shared.generic.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CaseStudyCollectionChangeModal
