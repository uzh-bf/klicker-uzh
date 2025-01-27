import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'

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

  const TriggerButton = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<typeof Button>
  >(function Trigger(props, forwardedRef) {
    return (
      <Button
        {...props}
        ref={forwardedRef}
        type="button"
        onClick={() => setDeletionConfirmationOpen(true)}
        className={{
          root: 'border-red-600 hover:border-red-600 hover:text-red-600',
        }}
        data={{ cy: `delete-case-${index}` }}
      >
        <FontAwesomeIcon icon={faTrashCan} />
        {t('manage.questionForms.removeCase')}
      </Button>
    )
  })

  return (
    <Modal
      open={deletionConfirmationOpen}
      onClose={() => setDeletionConfirmationOpen(false)}
      trigger={<TriggerButton />}
      title={t('manage.questionForms.confirmCaseDeletion')}
    >
      <div className="flex flex-col gap-4">
        <div>
          {t(
            hasSampleSolution
              ? 'manage.questionForms.confirmCaseDeleteSolutions'
              : 'manage.questionForms.confirmCaseDelete'
          )}
        </div>
        <div className="flex justify-between gap-2">
          <Button
            onClick={() => setDeletionConfirmationOpen(false)}
            data={{ cy: 'cancel-delete-case' }}
          >
            {t('shared.generic.cancel')}
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              setDeletionConfirmationOpen(false)
            }}
            className={{
              root: 'border-red-600 hover:border-red-600 hover:text-red-600',
            }}
            data={{ cy: 'confirm-delete-case' }}
          >
            {t('shared.generic.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CaseStudyCaseDeletionButton
