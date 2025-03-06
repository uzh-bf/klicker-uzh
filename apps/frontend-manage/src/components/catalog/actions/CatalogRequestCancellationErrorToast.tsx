import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogRequestCancellationErrorToast({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.requestCancellationFailed')}
    </Toast>
  )
}

export default CatalogRequestCancellationErrorToast
