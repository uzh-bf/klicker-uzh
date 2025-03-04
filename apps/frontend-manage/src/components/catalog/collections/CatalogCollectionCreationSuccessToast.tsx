import { Toast } from '@uzh-bf/design-system'
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
    <Toast
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3500}
    >
      {t('manage.catalog.collectionCreationSuccess')}
    </Toast>
  )
}

export default CatalogCollectionCreationSuccessToast
