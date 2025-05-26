import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AnswerCollectionDuplicationErrorToast({
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
      duration={5000}
      className={{ root: 'max-w-[30rem]' }}
      data={{ cy: 'collection-duplication-error' }}
    >
      {t('manage.resources.duplicationFailure')}
    </Toast>
  )
}

export default AnswerCollectionDuplicationErrorToast
