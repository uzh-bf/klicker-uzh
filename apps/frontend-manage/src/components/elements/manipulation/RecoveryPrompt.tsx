import { faArrowsRotate, faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function RecoveryPrompt({
  onRecovery,
  onDiscard,
  editMode = false,
  message,
}: {
  onRecovery: () => void
  onDiscard: () => void
  editMode?: boolean
  message?: string
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      hideCloseButton
      escapeDisabled
      onClose={() => null}
      title={t('manage.elements.recoverData')}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('manage.elements.discard')}</span>
        </div>
      }
      secondaryButtonStyle="destructive"
      onSecondaryAction={onDiscard}
      dataSecondaryAction={{ cy: 'discard-recovered-element-data' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faArrowsRotate} />
          <span>{t('manage.elements.loadData')}</span>
        </div>
      }
      primaryButtonStyle="primary"
      onPrimaryAction={onRecovery}
      dataPrimaryAction={{ cy: 'load-recovered-element-data' }}
      className={{ content: 'max-w-2xl' }}
    >
      <UserNotification
        type="warning"
        message={
          message ??
          (editMode
            ? t('manage.elements.temporaryStorageEditing')
            : t('manage.elements.temporaryStorageCreation'))
        }
        className={{ root: 'mt-2 text-base' }}
      />
    </Modal>
  )
}

export default RecoveryPrompt
