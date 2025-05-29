import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ObjectSharingSuccessToast({
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
      className={{ root: 'max-w-[30rem]' }}
      dataDismissible={{ cy: 'close-sharing-success-toast' }}
    >
      {t('manage.sharing.sharingSuccessful')}
    </ToastLegacy>
  )
}

export default ObjectSharingSuccessToast
