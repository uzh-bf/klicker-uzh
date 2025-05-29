import { PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
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
      hideCloseButton
      open={open}
      onClose={onClose}
      title={t('manage.sharing.modifyOwnPermissionsTitle')}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-modify-own-permissions' }}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      onPrimaryAction={onConfirm}
      dataPrimaryAction={{ cy: 'confirm-modify-own-permissions' }}
      className={{ content: 'max-w-lg' }}
      dataCloseButton={{ cy: 'close-modify-own-permissions-modal' }}
    >
      <div className="mt-2">
        {action === 'remove' ? (
          <p className="text-sm" data-cy="remove-own-access-warning">
            {t('manage.sharing.removeOwnPermissionsWarning')}
          </p>
        ) : (
          <p className="text-sm" data-cy="change-own-access-warning">
            {t('manage.sharing.changeOwnPermissionsWarning', {
              permissionLevel: t(
                `manage.sharing.permissions${newPermissionLevel ?? PermissionLevel.Read}`
              ),
            })}
          </p>
        )}
      </div>
    </Modal>
  )
}

export default ModifyOwnPermissionsModal
