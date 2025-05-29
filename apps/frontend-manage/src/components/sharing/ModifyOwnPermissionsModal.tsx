import { PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { Button, ModalLegacy } from '@uzh-bf/design-system'
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
    <ModalLegacy
      open={open}
      onClose={onClose}
      title={t('manage.sharing.modifyOwnPermissionsTitle')}
      className={{ content: 'max-w-lg' }}
      dataCloseButton={{ cy: 'close-modify-own-permissions-modal' }}
      hideCloseButton
    >
      <div className="mb-6">
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
    </ModalLegacy>
  )
}

export default ModifyOwnPermissionsModal
