import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CollectionAccessRemovalSuccessToast({
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
      duration={4000}
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.resources.accessRemovalSuccessful')}
    </Toast>
  )
}

export default CollectionAccessRemovalSuccessToast
