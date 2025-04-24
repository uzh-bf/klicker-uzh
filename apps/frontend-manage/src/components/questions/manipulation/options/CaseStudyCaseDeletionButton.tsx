import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import ForwardRefButton from '@klicker-uzh/shared-components/src/ForwardRefButton'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function CaseStudyCaseDeletionButton({
  hasSampleSolution,
  onConfirm,
  index,
}: {
  hasSampleSolution: boolean
  onConfirm: () => void
  index: number
}) {
  const t = useTranslations()
  const [deletionConfirmationOpen, setDeletionConfirmationOpen] =
    useState(false)

  return (
    <Modal
      open={deletionConfirmationOpen}
      onClose={() => setDeletionConfirmationOpen(false)}
      trigger={
        <ForwardRefButton
          onClick={() => setDeletionConfirmationOpen(true)}
          data={{ cy: `delete-case-${index}` }}
          overrideClassName="h-8 border-red-600 hover:border-red-600 hover:text-red-600"
        >
          <Button.Icon icon={faTrashCan} />
          <Button.Label>{t('manage.elementForms.removeCase')}</Button.Label>
        </ForwardRefButton>
      }
      title={t('manage.elementForms.confirmCaseDeletion')}
    >
      <div className="flex flex-col gap-4">
        <div>
          {t(
            hasSampleSolution
              ? 'manage.elementForms.confirmCaseDeleteSolutions'
              : 'manage.elementForms.confirmCaseDelete'
          )}
        </div>
        <div className="flex justify-between gap-2">
          <Button
            onClick={() => setDeletionConfirmationOpen(false)}
            data={{ cy: 'cancel-delete-case' }}
          >
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            destructive
            onClick={() => {
              onConfirm()
              setDeletionConfirmationOpen(false)
            }}
            data={{ cy: 'confirm-delete-case' }}
          >
            <Button.Label>{t('shared.generic.delete')}</Button.Label>
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CaseStudyCaseDeletionButton
