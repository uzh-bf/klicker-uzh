import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CatalogCollectionCreationSuccessToastProps {
  open: boolean
  onClose: () => void
}

function CatalogCollectionCreationSuccessToast({
  open,
  onClose,
}: CatalogCollectionCreationSuccessToastProps) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3500}
    >
      {t('manage.catalog.collectionCreationSuccess')}
    </ToastLegacy>
  )
}

export default CatalogCollectionCreationSuccessToast
