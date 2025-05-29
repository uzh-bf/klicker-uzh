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
          <Button.Label>{t('manage.elements.removeCase')}</Button.Label>
        </ForwardRefButton>
      }
      title={t('manage.elements.confirmCaseDeletion')}
      primaryLabel={t('shared.generic.delete')}
      primaryButtonStyle="destructive"
      onPrimaryAction={() => {
        onConfirm()
        setDeletionConfirmationOpen(false)
      }}
      dataPrimaryAction={{ cy: 'confirm-delete-case' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => setDeletionConfirmationOpen(false)}
      dataSecondaryAction={{ cy: 'cancel-delete-case' }}
      className={{ content: 'max-w-lg' }}
    >
      {t(
        hasSampleSolution
          ? 'manage.elements.confirmCaseDeleteSolutions'
          : 'manage.elements.confirmCaseDelete'
      )}
    </Modal>
  )
}

export default CaseStudyCaseDeletionButton
