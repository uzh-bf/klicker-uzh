import { PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ModifyOwnPermissionsModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  action: 'change' | 'remove'
  newPermissionLevel?: PermissionLevel
}

function ModifyOwnPermissionsModal({
  open,
  onClose,
  onConfirm,
  action,
  newPermissionLevel,
}: ModifyOwnPermissionsModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.resources.modifyOwnPermissionsTitle')}
      className={{ content: 'max-w-lg' }}
      dataCloseButton={{ cy: 'close-modify-own-permissions-modal' }}
      hideCloseButton
    >
      <div className="mb-6">
        {action === 'remove' ? (
          <p className="text-sm" data-cy="remove-own-access-warning">
            {t('manage.resources.removeOwnPermissionsWarning')}
          </p>
        ) : (
          <p className="text-sm" data-cy="change-own-access-warning">
            {t('manage.resources.changeOwnPermissionsWarning', {
              permissionLevel: t(
                `manage.resources.access${newPermissionLevel ?? PermissionLevel.Read}`
              ),
            })}
          </p>
        )}
      </div>

      <div className="flex flex-row justify-between gap-2">
        <Button
          onClick={onClose}
          data={{ cy: 'cancel-modify-own-permissions' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          destructive
          onClick={onConfirm}
          data={{ cy: 'confirm-modify-own-permissions' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default ModifyOwnPermissionsModal
