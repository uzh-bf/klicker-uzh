import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TemplateCreationErrorToastProps {
  open: boolean
  onClose: () => void
}

function TemplateCreationErrorToast({
  open,
  onClose,
}: TemplateCreationErrorToastProps) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
    >
      {t('manage.template.templateCreationError')}
    </ToastLegacy>
  )
}

export default TemplateCreationErrorToast
