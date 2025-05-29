import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ObjectRemovalErrorToast({
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
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3000}
    >
      {t('manage.sharing.removalFailed')}
    </ToastLegacy>
  )
}

export default ObjectRemovalErrorToast
