import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ObjectAddedErrorToastProps {
  open: boolean
  onClose: () => void
}

function ObjectAddedErrorToast({ open, onClose }: ObjectAddedErrorToastProps) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.objectAddedError')}
    </ToastLegacy>
  )
}

export default ObjectAddedErrorToast
