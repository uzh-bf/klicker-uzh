import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CatalogCollectionSharingErrorToastProps {
  open: boolean
  onClose: () => void
}

function CatalogCollectionSharingErrorToast({
  open,
  onClose,
}: CatalogCollectionSharingErrorToastProps) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.sharingFailed')}
    </Toast>
  )
}

export default CatalogCollectionSharingErrorToast
