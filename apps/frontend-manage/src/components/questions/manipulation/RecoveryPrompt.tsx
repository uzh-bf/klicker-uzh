import { faArrowsRotate, faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function RecoveryPrompt({
  open,
  onRecovery,
  onDiscard,
  editMode,
}: {
  open: boolean
  onRecovery: () => void
  onDiscard: () => void
  editMode: boolean
}) {
  const t = useTranslations()

  return (
    <Modal
      hideCloseButton
      escapeDisabled
      open={open}
      onClose={() => null}
      title={t('manage.questionForms.recoverData')}
      className={{ content: 'gap-1' }}
    >
      <UserNotification
        type="warning"
        message={
          editMode
            ? t('manage.questionForms.temporaryStorageEditing')
            : t('manage.questionForms.temporaryStorageCreation')
        }
        className={{ root: 'text-base' }}
      />
      <div className="mt-2 flex flex-row justify-between">
        <Button
          onClick={onDiscard}
          className={{
            root: 'border-2 border-red-600 hover:border-red-600 hover:text-red-600',
          }}
          data={{ cy: 'discard-recovered-element-data' }}
        >
          <FontAwesomeIcon icon={faBan} />
          <div>{t('manage.questionForms.discard')}</div>
        </Button>
        <Button
          onClick={onRecovery}
          className={{
            root: 'border-primary-80 hover:border-primary-80 border-2',
          }}
          data={{ cy: 'load-recovered-element-data' }}
        >
          <FontAwesomeIcon icon={faArrowsRotate} />
          <div>{t('manage.questionForms.loadData')}</div>
        </Button>
      </div>
    </Modal>
  )
}

export default RecoveryPrompt
