import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ObjectAddedErrorToastProps {
  open: boolean
  onClose: () => void
}

function ObjectAddedErrorToast({ open, onClose }: ObjectAddedErrorToastProps) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.objectAddedError')}
    </Toast>
  )
}

export default ObjectAddedErrorToast
