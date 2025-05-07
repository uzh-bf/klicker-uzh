import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ObjectAccessRemovalSuccessToast({
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
      className={{ root: 'max-w-[30rem]' }}
      dataDismissible={{ cy: 'close-removal-success-toast' }}
    >
      {t('manage.sharing.accessRemovalSuccessful')}
    </Toast>
  )
}

export default ObjectAccessRemovalSuccessToast
