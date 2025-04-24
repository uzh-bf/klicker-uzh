import { faArrowsRotate, faBan } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function RecoveryPrompt({
  open,
  onRecovery,
  onDiscard,
  editMode = false,
}: {
  open: boolean
  onRecovery: () => void
  onDiscard: () => void
  editMode?: boolean
}) {
  const t = useTranslations()

  return (
    <Modal
      hideCloseButton
      escapeDisabled
      open={open}
      onClose={() => null}
      title={t('manage.elementForms.recoverData')}
      className={{ content: 'gap-1' }}
    >
      <UserNotification
        type="warning"
        message={
          editMode
            ? t('manage.elementForms.temporaryStorageEditing')
            : t('manage.elementForms.temporaryStorageCreation')
        }
        className={{ root: 'text-base' }}
      />
      <div className="mt-2 flex flex-row justify-between">
        <Button
          destructive
          onClick={onDiscard}
          data={{ cy: 'discard-recovered-element-data' }}
        >
          <Button.Icon icon={faBan} />
          <Button.Label>{t('manage.elementForms.discard')}</Button.Label>
        </Button>
        <Button
          primary
          onClick={onRecovery}
          data={{ cy: 'load-recovered-element-data' }}
        >
          <Button.Icon icon={faArrowsRotate} />
          <Button.Label>{t('manage.elementForms.loadData')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default RecoveryPrompt
