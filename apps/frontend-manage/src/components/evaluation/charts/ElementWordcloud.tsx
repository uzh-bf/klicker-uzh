import {
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ElementWordcloudProps {
  instance: ElementInstanceEvaluation
  showSolution: boolean
  textSize: Record<string, number>
}

function ElementWordcloud({
  instance,
  showSolution,
  textSize,
}: ElementWordcloudProps) {
  const t = useTranslations()
  const supportedElementTypes = [ElementType.Numerical, ElementType.FreeText]

  // TODO: data format conversion with custom hook and feed into table component

  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return <div>WORDCLOUD CHART</div>
}

export default ElementWordcloud
