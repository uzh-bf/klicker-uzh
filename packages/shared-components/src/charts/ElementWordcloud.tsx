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

  // determine frequencies of responses
  const frequencies: Record<string, number> = {}
  const ignoreTags: string[] = [
    'Pronoun',
    'Determiner',
    'Conjunction',
    'Preposition',
    'Auxiliary',
    // TODO: adjust tags
  ]
  data.forEach((response) => {
    const doc = nlp(response.value)

    // filter out words of responses based on list of tags
    const tagged: Record<string, string[]>[] = doc.out('tags')

    tagged.forEach((entry) => {
      const entities = Object.entries(entry)
        .filter(([_, tags]) => !tags.some((tag) => ignoreTags.includes(tag)))
        .map(([entity]) => entity.toLowerCase())
      const phrase = entities.join(' ')
      if (phrase.length > 0) {
        frequencies[phrase] = (frequencies[phrase] || 0) + response.count
      }
    })
  })

  const processedData = Object.entries(frequencies).map(([value, count]) => ({
    text: value,
    value: count,
  }))

  // when displaying only one word, do not rotate
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
      </div>
    </div>
  )
}

export default ElementWordcloud
