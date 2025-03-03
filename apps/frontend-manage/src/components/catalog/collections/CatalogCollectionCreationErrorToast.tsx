import { Toast } from '@uzh-bf/design-system'
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
    <Toast
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.collectionCreationError')}
    </Toast>
  )
}

export default CatalogCollectionCreationErrorToast
