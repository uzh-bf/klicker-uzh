import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface PermissionRevocationModalProps {
  open: boolean
  onClose: () => void
  onRevocation: () => Promise<void>
  username?: string
  userGroup?: string
}

function PermissionRevocationModal({
  open,
  onClose,
  onRevocation,
  username,
  userGroup,
}: PermissionRevocationModalProps) {
  const t = useTranslations()
  const [isRevoking, setIsRevoking] = useState(false)

  const handleRevocation = async () => {
    setIsRevoking(true)
    try {
      await onRevocation()
    } finally {
      setIsRevoking(false)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.sharing.revokeDirectPermission')}
      className={{ content: 'max-w-lg' }}
      dataCloseButton={{ cy: 'close-permission-revocation-modal' }}
      hideCloseButton
    >
      <div className="mb-6">
        <p className="mb-2 text-base">
          {username
            ? t.rich('manage.sharing.revokeUserPermission', {
                username,
                b: (text) => <b>{text}</b>,
              })
            : t.rich('manage.sharing.revokeGroupPermission', {
                groupName: userGroup,
                b: (text) => <b>{text}</b>,
              })}
        </p>
        <p className="text-sm text-gray-600">
          {t('manage.sharing.derivedPermissionWarning')}
        </p>
      </div>

      <div className="flex flex-row justify-between gap-2">
        <Button
          onClick={onClose}
          disabled={isRevoking}
          data={{ cy: 'cancel-revocation' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
        <Button
          destructive
          onClick={handleRevocation}
          loading={isRevoking}
          data={{ cy: 'confirm-revocation' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default PermissionRevocationModal
