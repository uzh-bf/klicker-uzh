import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ObjectAddedSuccessToastProps {
  open: boolean
  onClose: () => void
}

function ObjectAddedSuccessToast({
  open,
  onClose,
}: ObjectAddedSuccessToastProps) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3500}
    >
      {t('manage.catalog.objectAddedSuccess')}
    </ToastLegacy>
  )
}

export default ObjectAddedSuccessToast
