import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
// import { TagCloud } from 'react-tagcloud'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import dynamic from 'next/dynamic'
import { twMerge } from 'tailwind-merge'
import model from 'wink-eng-lite-web-model'
import winkNLP, { type ItemToken } from 'wink-nlp'
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

  const frequencies: Record<string, number> = {}

  const nlp = winkNLP(model)
  const its = nlp.its
  data.forEach((response) => {
    const doc = nlp.readDoc(response.value)
    doc
      .tokens()
      .filter(
        (t: ItemToken) => t.out(its.type) === 'word' && !t.out(its.stopWordFlag)
      )
      .each((itemToken: ItemToken) => {
        const token = itemToken.out().toLowerCase()
        frequencies[token] = (frequencies[token] || 0) + 1
      })
  })

  const processedData = Object.entries(frequencies).map(([value, count]) => ({
    text: value,
    value: count,
  }))

  const rotationAngles: [number, number] = [
    0,
    processedData.length > 1 ? -90 : 0,
  ]
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
            fontSizes: [textSize.min, textSize.max],
            colors: CHART_COLORS,
            transitionDuration: 1000,
            scale: 'log',
            spiral: 'archimedean',
          }}
        />
        )
      </div>
    </div>
  )
}

export default ElementWordcloud
