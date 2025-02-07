import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function EvaluationUnavailableNotification() {
  const t = useTranslations()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <UserNotification
        className={{
          root: 'max-w-[80%] text-lg lg:max-w-[60%] 2xl:max-w-[50%]',
        }}
        message={t('manage.evaluation.evaluationNotYetAvailable')}
      />
    </div>
  )
}

export default EvaluationUnavailableNotification
