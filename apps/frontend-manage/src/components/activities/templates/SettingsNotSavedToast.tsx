import { ToastLegacy } from '@uzh-bf/design-system'
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
    <ToastLegacy
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={onClose}
      duration={4000}
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.template.settingsNotSaved')}
    </ToastLegacy>
  )
}

export default SettingsNotSavedToast
