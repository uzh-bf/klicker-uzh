import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface PermissionRevocationModalProps {
  onClose: () => void
  onRevocation: () => Promise<boolean>
  username?: string
  userGroup?: string
}

function PermissionRevocationModal({
  onClose,
  onRevocation,
  username,
  userGroup,
}: PermissionRevocationModalProps) {
  const t = useTranslations()
  const [isRevoking, setIsRevoking] = useState(false)

  const handleClose = () => {
    if (!isRevoking) {
      onClose()
    }
  }

  const handleRevocation = async () => {
    if (isRevoking) return

    setIsRevoking(true)
    let success = false
    try {
      success = await onRevocation()
    } finally {
      setIsRevoking(false)
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
      title={t('manage.sharing.revokeDirectPermission')}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
      dataSecondaryAction={{ cy: 'cancel-revocation' }}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={isRevoking}
      primaryDisabled={isRevoking}
      primaryButtonStyle="destructive"
      onPrimaryAction={handleRevocation}
      dataPrimaryAction={{ cy: 'confirm-revocation' }}
      className={{ content: 'max-w-lg' }}
      dataCloseButton={{ cy: 'close-permission-revocation-modal' }}
    >
      <div className="mb-4 mt-2">
        <p className="mb-2 text-base">
          {username
            ? t.rich('manage.sharing.revokeUserPermission', {
                username,
                b: (text) => <b>{text}</b>,
              })
            : t.rich('manage.sharing.revokeGroupPermission', {
                groupName: userGroup!,
                b: (text) => <b>{text}</b>,
              })}
        </p>
        <p className="text-sm text-gray-600">
          {t('manage.sharing.derivedPermissionWarning')}
        </p>
      </div>
    </Modal>
  )
}

export default PermissionRevocationModal
