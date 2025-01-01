import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CollectionErrorToast({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      className={{ root: 'max-w-[30rem]' }}
      duration={10000}
    >
      {t('manage.resources.collectionCreationError')}
    </Toast>
  )
}

export default CollectionErrorToast
