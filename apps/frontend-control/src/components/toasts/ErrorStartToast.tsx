import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ErrorStartToastProps {
  open: boolean
  setOpen: (open: boolean) => void
}

function ErrorStartToast({ open, setOpen }: ErrorStartToastProps) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      type="error"
      duration={5000}
    >
      {t('control.course.sessionStartFailed')}
    </Toast>
  )
}

export default ErrorStartToast
