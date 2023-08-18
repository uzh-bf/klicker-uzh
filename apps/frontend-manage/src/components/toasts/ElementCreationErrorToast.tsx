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
      duration={6000}
      openExternal={open}
      setOpenExternal={setOpen}
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
