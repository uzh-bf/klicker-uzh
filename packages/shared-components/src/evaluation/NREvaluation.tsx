import {
  ElementType,
  type NumericalElementOptions,
  type NumericalInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import React from 'react'
import ElementHistogram from '../charts/ElementHistogram'

interface NREvaluationProps {
  options: NumericalElementOptions
  evaluation: NumericalInstanceEvaluation
  reference?: string
}

function NREvaluation({ options, evaluation, reference }: NREvaluationProps) {
  const t = useTranslations()

  return (
    <div className="h-40 space-y-2">
      <div className="font-bold">{t('pwa.practiceQuiz.othersAnswered')}</div>
      <ElementHistogram
        type={ElementType.Numerical}
        responses={evaluation.responses ?? []}
        solutionRanges={options.solutionRanges ?? undefined}
        exactSolutions={options.exactSolutions ?? undefined}
        minValue={options.restrictions?.min}
        maxValue={options.restrictions?.max}
        textSize="md"
        className={{ root: 'h-40' }}
        reference={reference ? parseFloat(reference) : undefined}
        showSolution
        hideBins
        basic
      />
    </div>
  )
}

export default NREvaluation
