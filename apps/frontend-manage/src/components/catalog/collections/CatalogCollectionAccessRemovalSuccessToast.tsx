import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CatalogCollectionAccessRemovalSuccessToastProps {
  open: boolean
  onClose: () => void
}

function CatalogCollectionAccessRemovalSuccessToast({
  open,
  onClose,
}: CatalogCollectionAccessRemovalSuccessToastProps) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3500}
    >
      {t('manage.catalog.accessRemovalSuccessful')}
    </Toast>
  )
}

export default CatalogCollectionAccessRemovalSuccessToast
