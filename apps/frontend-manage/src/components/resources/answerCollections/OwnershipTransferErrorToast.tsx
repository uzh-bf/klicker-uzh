import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface OwnershipTransferErrorToastProps {
  open: boolean
  onClose: () => void
}

function OwnershipTransferErrorToast({
  open,
  onClose,
}: OwnershipTransferErrorToastProps) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
      className={{ root: 'max-w-[32rem]' }}
    >
      {t('manage.resources.ownershipTransferError')}
    </Toast>
  )
}

export default OwnershipTransferErrorToast
