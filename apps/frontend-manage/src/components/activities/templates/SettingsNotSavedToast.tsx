import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function SettingsNotSavedToast({
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
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
      duration={4000}
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.template.settingsNotSaved')}
    </Toast>
  )
}

export default SettingsNotSavedToast
