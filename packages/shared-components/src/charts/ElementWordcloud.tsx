import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { TagCloud } from 'react-tagcloud'
import { twMerge } from 'tailwind-merge'
import EvaluationExplanation from '../evaluation/EvaluationExplanation'

interface ElementWordcloudProps {
  instance: ElementInstanceEvaluation
  showSolution: boolean
  showExplanation: boolean
  textSize: {
    text: string
    textLg: string
    min: number
    max: number
  }
  className?: string
}

function ElementWordcloud({
  instance,
  showSolution,
  showExplanation,
  textSize,
  className,
}: ElementWordcloudProps) {
  const t = useTranslations()
  const supportedElementTypes = [ElementType.Numerical, ElementType.FreeText]

  const processedData =
    instance.__typename === 'NumericalActivityEvaluationData'
      ? instance.results.responseValues.map((response) => ({
          value: String(response.value),
          count: response.count,
        }))
      : instance.__typename === 'FreeTextActivityEvaluationData'
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
    <div className={twMerge('flex h-full w-full flex-col', className)}>
      <EvaluationExplanation
        explanation={instance.explanation}
        showExplanation={showExplanation}
        textSize={textSize.text}
        textSizeLg={textSize.textLg}
      />
      <div className="p-4">
        <TagCloud
          colorOptions={{ luminosity: 'dark' }}
          maxSize={textSize.max}
          minSize={textSize.min}
          shuffle={false}
          tags={processedData}
        />
      </div>
    </div>
  )
}

export default ElementWordcloud
