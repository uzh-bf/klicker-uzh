import { faArrowsRotate, faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, UserNotification } from '@uzh-bf/design-system'
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
      title={t('manage.elements.recoverData')}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faBan} />
          <span>{t('manage.elements.discard')}</span>
        </div>
      }
      primaryButtonStyle="destructive"
      onPrimaryAction={onDiscard}
      dataPrimaryAction={{ cy: 'discard-recovered-element-data' }}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faArrowsRotate} />
          <span>{t('manage.elements.loadData')}</span>
        </div>
      }
      secondaryButtonStyle="primary"
      onSecondaryAction={onRecovery}
      dataSecondaryAction={{ cy: 'load-recovered-element-data' }}
    >
      <UserNotification
        type="warning"
        message={
          editMode
            ? t('manage.elements.temporaryStorageEditing')
            : t('manage.elements.temporaryStorageCreation')
        }
        className={{ root: 'mt-2 text-base' }}
      />
    </Modal>
  )
}

export default RecoveryPrompt
