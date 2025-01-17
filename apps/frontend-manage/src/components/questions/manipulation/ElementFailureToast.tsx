import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ElementFailureToast({
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
      duration={6000}
      className={{ root: 'max-w-[30rem]' }}
    >
      {t('manage.questionForms.questionSavedFailed')}
    </Toast>
  )
}

export default ElementFailureToast
