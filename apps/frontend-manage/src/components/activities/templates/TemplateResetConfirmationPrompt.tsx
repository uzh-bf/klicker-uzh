import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
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
    <Modal
      hideCloseButton
      escapeDisabled
      open={open}
      onClose={() => null}
      title={t('manage.template.resetConfirmation')}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-template-reset' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <Button.Icon icon={faArrowsRotate} />
          <span>{t('manage.template.confirmReset')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      onPrimaryAction={onConfirm}
      dataPrimaryAction={{ cy: 'confirm-template-reset' }}
      // className={{ content: 'max-w-2xl gap-1' }}
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
