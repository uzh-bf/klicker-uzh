import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalogCollectionRequestAccessSuccessToast({
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
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3500}
    >
      {t('manage.catalog.requestAccessSuccess')}
    </Toast>
  )
}

export default CatalogCollectionRequestAccessSuccessToast
