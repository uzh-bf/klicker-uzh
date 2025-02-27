import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface OwnershipTransferSuccessToastProps {
  open: boolean
  onClose: () => void
}

function OwnershipTransferSuccessToast({
  open,
  onClose,
}: OwnershipTransferSuccessToastProps) {
  const t = useTranslations()

  return (
    <Toast
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      className={{ root: 'max-w-[32rem]' }}
    >
      {t('manage.resources.ownershipTransferSuccess')}
    </Toast>
  )
}

export default OwnershipTransferSuccessToast
