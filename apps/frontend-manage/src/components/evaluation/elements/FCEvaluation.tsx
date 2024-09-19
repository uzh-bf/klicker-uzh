import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface FCEvaluationProps {
  evaluation: ElementInstanceEvaluation
}

function FCEvaluation({ evaluation }: FCEvaluationProps) {
  const t = useTranslations()

  return (
    <UserNotification type="info" className={{ root: 'm-3 h-max w-full' }}>
      {t('manage.evaluation.noFlashcardEvaluation')}
    </UserNotification>
  )
}

export default FCEvaluation
