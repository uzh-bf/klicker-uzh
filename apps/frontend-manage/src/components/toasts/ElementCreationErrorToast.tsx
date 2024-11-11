import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ElementCreationErrorToastProps {
  error: string
  open: boolean
  setOpen: (open: boolean) => void
}

function ElementCreationErrorToast({
  error,
  open,
  setOpen,
}: ElementCreationErrorToastProps): React.ReactElement {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      duration={6000}
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      type="error"
    >
      <div>
        <div>{error}</div>
        <div>{t('manage.sessionForms.considerFormErrors')}</div>
      </div>
    </Toast>
  )
}

export default ElementCreationErrorToast
