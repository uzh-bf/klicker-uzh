import { faToggleOff, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ModerationChangeModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  unpublishedCount: number
  loading?: boolean
}

function ModerationChangeModal({
  open,
  onClose,
  onConfirm,
  unpublishedCount,
  loading = false,
}: ModerationChangeModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.cockpit.disableModerationTitle')}
      secondaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faX} />
          <span>{t('shared.generic.cancel')}</span>
        </div>
      }
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-moderation-change' }}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faToggleOff} />
          <span>{t('shared.generic.confirm')}</span>
        </div>
      }
      primaryLoading={loading}
      onPrimaryAction={async () => {
        await onConfirm()
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-moderation-change' }}
      data={{ cy: 'moderation-change-modal' }}
      className={{ content: 'max-w-xl' }}
    >
      <div className="space-y-2">
        <span className="text-base">
          {t('manage.cockpit.disableModerationMessage', {
            count: unpublishedCount,
          })}{' '}
        </span>
        {unpublishedCount > 0 && (
          <span className="text-red-600">
            {t('manage.cockpit.autoPublishWarningMessage', {
              count: unpublishedCount,
            })}
          </span>
        )}
      </div>
    </Modal>
  )
}

export default ModerationChangeModal
