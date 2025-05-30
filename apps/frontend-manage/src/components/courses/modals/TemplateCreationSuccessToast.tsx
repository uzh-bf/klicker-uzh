import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TemplateCreationSuccessToastProps {
  open: boolean
  onClose: () => void
}

function TemplateCreationSuccessToast({
  open,
  onClose,
}: TemplateCreationSuccessToastProps) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3500}
    >
      {t('manage.template.templateCreationSuccess')}
    </ToastLegacy>
  )
}

export default TemplateCreationSuccessToast
