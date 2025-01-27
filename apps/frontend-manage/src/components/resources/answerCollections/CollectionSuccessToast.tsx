import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CollectionSuccessToast({
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
      type="success"
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      className={{ root: 'max-w-[30rem]' }}
      duration={3000}
    >
      {t('manage.resources.collectionCreationSuccess')}
    </Toast>
  )
}

export default CollectionSuccessToast
