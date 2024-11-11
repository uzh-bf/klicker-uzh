import {
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { TagCloud } from 'react-tagcloud'

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

  const processedData =
    instance.__typename === 'NumericalElementInstanceEvaluation'
      ? instance.results.responseValues.map((response) => ({
          value: String(response.value),
          count: response.count,
        }))
      : instance.__typename === 'FreeElementInstanceEvaluation'
        ? instance.results.responses
        : []

  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return (
    <div className="flex h-full w-full p-4">
      <TagCloud
        colorOptions={{ luminosity: 'dark' }}
        maxSize={textSize.max}
        minSize={textSize.min}
        shuffle={false}
        tags={processedData}
      />
    </div>
  )
}

export default ElementWordcloud
