import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CollectionDeletionSuccessToast({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3000}
    >
      {t('manage.resources.deletionSuccessful')}
    </ToastLegacy>
  )
}

export default CollectionDeletionSuccessToast
