import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { Button, ModalLegacy, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TemplateResetConfirmationPrompt({
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
      hideCloseButton
      escapeDisabled
      open={open}
      onClose={() => null}
      title={t('manage.template.resetConfirmation')}
      className={{ content: 'max-w-2xl gap-1' }}
    >
      <UserNotification
        type="warning"
        message={t('manage.template.resetWarning')}
        className={{ root: 'text-base' }}
      />
      <div className="mt-4 flex flex-row justify-between">
        <Button onClick={onClose} data={{ cy: 'cancel-template-reset' }}>
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          destructive
          onClick={onConfirm}
          data={{ cy: 'confirm-template-reset' }}
        >
          <Button.Icon icon={faArrowsRotate} />
          <Button.Label>{t('manage.template.confirmReset')}</Button.Label>
        </Button>
      </div>
    </ModalLegacy>
  )
}

export default TemplateResetConfirmationPrompt
