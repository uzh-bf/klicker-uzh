import { ObjectType, PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ModifyOwnPermissionsModalProps {
  onClose: () => void
  onConfirm: () => void
  action: 'change' | 'remove'
  newPermissionLevel?: PermissionLevel
  objectType?: ObjectType
}

function ModifyOwnPermissionsModal({
  onClose,
  onConfirm,
  action,
  newPermissionLevel,
  objectType,
}: ModifyOwnPermissionsModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open
      hideCloseButton
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
          <>
            <p className="text-sm" data-cy="remove-own-access-warning">
              {t('manage.sharing.removeOwnPermissionsWarning')}
            </p>
            {objectType === ObjectType.Kb ? (
              <p className="mt-2 text-sm text-gray-600">
                {t('manage.sharing.knowledgeBaseRevocationWarning')}
              </p>
            ) : null}
          </>
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
