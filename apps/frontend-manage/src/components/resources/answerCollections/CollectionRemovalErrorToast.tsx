import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CollectionRemovalErrorToast({
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
      duration={3000}
    >
      {t('manage.resources.removalFailed')}
    </Toast>
  )
}

export default CollectionRemovalErrorToast
