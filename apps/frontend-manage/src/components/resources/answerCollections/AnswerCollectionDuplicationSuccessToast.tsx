import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AnswerCollectionDuplicationSuccessToast({
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
      type="success"
      openExternal={open}
      onCloseExternal={onClose}
      duration={3000}
      className={{ root: 'max-w-[30rem]' }}
      data={{ cy: 'collection-duplication-success' }}
    >
      {t('manage.resources.duplicationSuccess')}
    </Toast>
  )
}

export default AnswerCollectionDuplicationSuccessToast
