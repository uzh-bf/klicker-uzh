import {
  ElementType,
  type NumericalInstanceEvaluation,
  type NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import React from 'react'
import ElementHistogram from '../charts/ElementHistogram'

interface NREvaluationProps {
  options: NumericalQuestionOptions
  evaluation: NumericalInstanceEvaluation
  reference?: string
}

function NREvaluation({ options, evaluation, reference }: NREvaluationProps) {
  const t = useTranslations()

  const answers = evaluation.answers as Record<
    string,
    { value: string; count: number; correct: boolean }
  >
  const responses = Object.entries(answers).map(([_, answer]) => ({
    value: parseFloat(answer.value),
    count: answer.count,
  }))

  return (
    <div className="h-40 space-y-2">
      <div className="font-bold">{t('pwa.practiceQuiz.othersAnswered')}</div>
      <ElementHistogram
        type={ElementType.Numerical}
        responses={responses}
        solutionRanges={options.solutionRanges ?? undefined}
        minValue={options.restrictions?.min}
        maxValue={options.restrictions?.max}
        showSolution={{ general: true }}
        textSize="md"
        className={{ root: 'h-40' }}
        reference={reference ? parseFloat(reference) : undefined}
        hideBins
        basic
      />
    </div>
  )
}

export default NREvaluation
