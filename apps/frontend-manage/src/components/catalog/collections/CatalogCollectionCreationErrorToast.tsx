import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CatalogCollectionCreationErrorToastProps {
  open: boolean
  onClose: () => void
}

function CatalogCollectionCreationErrorToast({
  open,
  onClose,
}: CatalogCollectionCreationErrorToastProps) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.collectionCreationError')}
    </ToastLegacy>
  )
}

export default CatalogCollectionCreationErrorToast
