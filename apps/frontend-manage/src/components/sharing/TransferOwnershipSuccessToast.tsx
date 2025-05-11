import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TransferOwnershipSuccessToastProps {
  open: boolean
  onClose: () => void
}

function TransferOwnershipSuccessToast({
  open,
  onClose,
}: TransferOwnershipSuccessToastProps) {
  const t = useTranslations()

  return (
    <Toast
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      className={{ root: 'max-w-[32rem]' }}
      duration={3000}
    >
      {t('manage.sharing.ownershipTransferSuccess')}
    </Toast>
  )
}

export default TransferOwnershipSuccessToast
