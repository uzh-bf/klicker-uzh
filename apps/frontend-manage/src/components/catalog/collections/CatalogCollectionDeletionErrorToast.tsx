import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogCollectionDeletionErrorToast({
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
      {t('manage.catalog.deletionFailed')}
    </Toast>
  )
}

export default CatalogCollectionDeletionErrorToast
