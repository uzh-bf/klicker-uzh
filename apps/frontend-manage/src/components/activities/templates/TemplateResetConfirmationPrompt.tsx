import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TemplateResetConfirmationPrompt({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      hideCloseButton
      escapeDisabled
      onClose={() => null}
      title={t('manage.template.resetConfirmation')}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-template-reset' }}
      primaryLabel={
        <div className="flex flex-row items-center">
          <Button.Icon icon={faArrowsRotate} />
          <Button.Label>{t('manage.template.confirmReset')}</Button.Label>
        </div>
      }
      primaryButtonStyle="destructive"
      onPrimaryAction={onConfirm}
      dataPrimaryAction={{ cy: 'confirm-template-reset' }}
      className={{ content: 'max-w-2xl' }}
    >
      <UserNotification
        type="warning"
        message={t('manage.template.resetWarning')}
        className={{ root: 'mt-2 text-base' }}
      />
    </Modal>
  )
}

export default TemplateResetConfirmationPrompt
