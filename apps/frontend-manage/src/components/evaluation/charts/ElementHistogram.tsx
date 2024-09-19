import {
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ElementHistogramProps {
  instance: ElementInstanceEvaluation
  showSolution: {
    general: boolean
    mean?: boolean
    median?: boolean
    q1?: boolean
    q3?: boolean
    sd?: boolean
  }
  textSize: string
}

function ElementHistogram({
  instance,
  showSolution,
  textSize,
}: ElementHistogramProps) {
  const t = useTranslations()
  const supportedElementTypes = [ElementType.Numerical]

  // TODO: data format conversion with custom hook and feed into table component

  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return <div>HISTOGRAM CHART</div>
}

export default ElementHistogram
