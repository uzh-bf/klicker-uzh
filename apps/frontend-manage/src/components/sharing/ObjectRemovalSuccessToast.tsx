import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ObjectRemovalSuccessToast({
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
      duration={3000}
    >
      {t('manage.sharing.removalSuccessful')}
    </Toast>
  )
}

export default ObjectRemovalSuccessToast
