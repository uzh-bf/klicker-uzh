import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TemplateEditErrorToast({
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
      duration={4500}
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.template.templateEditError')}
    </ToastLegacy>
  )
}

export default TemplateEditErrorToast
