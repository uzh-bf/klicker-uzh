import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ObjectSharingErrorToast({
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
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.sharing.sharingFailed')}
    </ToastLegacy>
  )
}

export default ObjectSharingErrorToast
