import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CatalogCollectionAccessRemovalErrorToastProps {
  open: boolean
  onClose: () => void
}

function CatalogCollectionAccessRemovalErrorToast({
  open,
  onClose,
}: CatalogCollectionAccessRemovalErrorToastProps) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.catalog.accessRemovalFailed')}
    </Toast>
  )
}

export default CatalogCollectionAccessRemovalErrorToast
