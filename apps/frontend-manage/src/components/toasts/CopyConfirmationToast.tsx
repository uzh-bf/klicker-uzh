import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CopyConfirmationToast({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (value: boolean) => void
}) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      type="success"
      duration={4000}
      className={{ root: 'w-[24rem]' }}
    >
      {t('manage.course.linkAccessCopied')}
    </ToastLegacy>
  )
}

export default CopyConfirmationToast
