import { faArrowsRotate, faForward } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityRecoveryPrompt({
  open,
  onRecovery,
  onDiscard,
}: {
  open: boolean
  onRecovery: () => void
  onDiscard: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      hideCloseButton
      escapeDisabled
      open={open}
      onClose={() => null}
      title={t('manage.template.recoverTemplateActivityInputs')}
      className={{ content: 'gap-1' }}
    >
      <UserNotification
        type="warning"
        message={t('manage.template.incompleteActivity')}
        className={{ root: 'text-base' }}
      />
      <div className="mt-4 flex flex-row justify-between">
        <Button
          destructive
          onClick={onDiscard}
          data={{ cy: 'discard-recovered-activity-data' }}
        >
          <Button.Icon icon={faArrowsRotate} />
          <Button.Label>{t('manage.template.startOver')}</Button.Label>
        </Button>
        <Button
          primary
          onClick={onRecovery}
          data={{ cy: 'load-recovered-activity-data' }}
        >
          <Button.Icon icon={faForward} />
          <Button.Label>{t('manage.template.continueEditing')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default ActivityRecoveryPrompt
