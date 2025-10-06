import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { UserNotification } from '@uzh-bf/design-system'
import nlp from 'compromise'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import EvaluationExplanation from '../evaluation/EvaluationExplanation'

const ReactWordcloud = dynamic(() => import('react-wordcloud'), {
  ssr: false,
})

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
  wordCloudTags?: string[]
}

function ElementWordcloud({
  instance,
  showSolution,
  showExplanation,
  textSize,
  className,
  wordCloudTags,
}: ElementWordcloudProps) {
  const t = useTranslations()
  const supportedElementTypes = [ElementType.Numerical, ElementType.FreeText]

  const data =
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

  // determine frequencies of responses
  const frequencies: Record<string, number> = {}
  const applyFilter = wordCloudTags && wordCloudTags.length > 0
  data.forEach((response) => {
    if (!applyFilter) {
      const regex = /[^.;:!?]+[.;:!?]+(?=\s|$)/g
      const sentences = response.value.match(regex)?.map((s) => s.trim())

      if (!sentences) {
        frequencies[response.value] =
          (frequencies[response.value] || 0) + response.count
        return
      }

      for (const sentence of sentences) {
        frequencies[sentence] = (frequencies[sentence] || 0) + response.count
      }
    } else {
      for (const tag of wordCloudTags) {
        const doc = nlp(response.value)
        doc
          .match(tag)
          .out('array')
          .forEach((word: string) => {
            const sanitizedWord = word.replace(/[.,;:!?]/g, '')
            frequencies[sanitizedWord] =
              (frequencies[sanitizedWord] || 0) + response.count
          })
      }
    }
  })

  const processedData = Object.entries(frequencies).map(([value, count]) => ({
    text: value,
    value: count,
  }))
  const hasDataToDisplay = processedData.length > 1

  // when displaying only one answer, do not rotate
  const rotationAngles: [number, number] = [
    0,
    applyFilter && hasDataToDisplay ? -90 : 0,
  ]
  const minTextSize = textSize.min
  const maxTextSize = textSize.max
  return (
    <div className={twMerge('flex h-full w-full flex-col', className)}>
      <EvaluationExplanation
        explanation={instance.explanation}
        showExplanation={showExplanation}
        textSize={textSize.text}
        textSizeLg={textSize.textLg}
      />
      <div className="h-full w-full p-4">
        <ReactWordcloud
          key={`wc-${processedData.length}`}
          words={processedData}
          options={{
            enableTooltip: false,
            deterministic: true,
            randomSeed: '42',
            padding: 5,
            rotations: 2,
            rotationAngles: rotationAngles,
            fontSizes: [minTextSize, maxTextSize],
            colors: CHART_COLORS,
            transitionDuration: 500,
            scale: 'log',
            spiral: 'archimedean',
          }}
        />
      </div>
    </div>
  )
}

export default ElementWordcloud
