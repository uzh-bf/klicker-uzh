import {
  ElementInstanceEvaluation,
  ElementType,
  FreeElementInstanceEvaluation,
  NumericalElementInstanceEvaluation,
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
    instance.type === ElementType.Numerical
      ? (
          instance as NumericalElementInstanceEvaluation
        ).results.responseValues.map((response) => ({
          value: String(response.value),
          count: response.count,
        }))
      : instance.type === ElementType.FreeText
        ? (instance as FreeElementInstanceEvaluation).results.responses
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
