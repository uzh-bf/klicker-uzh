import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TemplateDeletionSuccessToast({
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
      duration={3000}
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.template.templateDeletionSuccess')}
    </ToastLegacy>
  )
}

export default TemplateDeletionSuccessToast
