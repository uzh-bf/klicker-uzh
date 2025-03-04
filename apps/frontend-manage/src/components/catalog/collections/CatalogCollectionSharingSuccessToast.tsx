import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CatalogCollectionSharingSuccessToastProps {
  open: boolean
  onClose: () => void
}

function CatalogCollectionSharingSuccessToast({
  open,
  onClose,
}: CatalogCollectionSharingSuccessToastProps) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3500}
    >
      {t('manage.catalog.sharingSuccessful')}
    </Toast>
  )
}

export default CatalogCollectionSharingSuccessToast
