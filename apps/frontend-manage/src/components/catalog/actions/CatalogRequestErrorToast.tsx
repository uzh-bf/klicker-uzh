import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogRequestErrorToast({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.requestCatalogObjectFailed')}
    </ToastLegacy>
  )
}

export default CatalogRequestErrorToast
