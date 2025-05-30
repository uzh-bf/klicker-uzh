import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TransferOwnershipErrorToastProps {
  open: boolean
  onClose: () => void
}

function TransferOwnershipErrorToast({
  open,
  onClose,
}: TransferOwnershipErrorToastProps) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
      className={{ root: 'max-w-[32rem]' }}
    >
      {t('manage.sharing.ownershipTransferError')}
    </ToastLegacy>
  )
}

export default TransferOwnershipErrorToast
