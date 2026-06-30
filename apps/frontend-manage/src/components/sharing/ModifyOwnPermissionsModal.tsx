import { PermissionLevel } from '@lib/constants/sharingEnums'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface ModifyOwnPermissionsModalProps {
  onClose: () => void
  onConfirm: () => Promise<boolean>
  action: 'change' | 'remove'
  newPermissionLevel?: PermissionLevel
}

function ModifyOwnPermissionsModal({
  onClose,
  onConfirm,
  action,
  newPermissionLevel,
}: ModifyOwnPermissionsModalProps) {
  const t = useTranslations()
  const [isConfirming, setIsConfirming] = useState(false)

  const handleClose = () => {
    if (!isConfirming) {
      onClose()
    }
  }

  const handleConfirm = async () => {
    if (isConfirming) return

    setIsConfirming(true)
    let success = false
    try {
      success = await onConfirm()
    } finally {
      setIsConfirming(false)
    }

    if (success) {
      onClose()
    }
  }

  return (
    <Modal
      open
      hideCloseButton
      onClose={handleClose}
      title={t('manage.sharing.modifyOwnPermissionsTitle')}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-modify-own-permissions' }}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={isConfirming}
      primaryDisabled={isConfirming}
      onPrimaryAction={handleConfirm}
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
