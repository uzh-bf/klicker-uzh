import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TemplateEditSuccessToast({
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
      duration={3000}
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.template.templateEditSuccess')}
    </Toast>
  )
}

export default TemplateEditSuccessToast
