import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CTEvaluationProps {
  evaluation: ElementInstanceEvaluation
}

function CTEvaluation({ evaluation }: CTEvaluationProps) {
  const t = useTranslations()

  return (
    <UserNotification type="info" className={{ root: 'm-3 h-max w-full' }}>
      {t('manage.evaluation.noContentEvaluation')}
    </UserNotification>
  )
}

export default CTEvaluation
