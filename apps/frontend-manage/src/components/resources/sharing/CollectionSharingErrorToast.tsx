import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CollectionSharingErrorToast({
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
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.resources.sharingFailed')}
    </Toast>
  )
}

export default CollectionSharingErrorToast
