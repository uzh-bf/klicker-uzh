import type {
  NumericalInstanceEvaluation,
  NumericalQuestionData,
  NumericalQuestionOptions,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import React from 'react'
import Histogram from '../Histogram'

interface NREvaluationProps {
  options: NumericalQuestionOptions
  evaluation: NumericalInstanceEvaluation
  reference?: string
}

function NREvaluation({ options, evaluation, reference }: NREvaluationProps) {
  const t = useTranslations()

  const results = Object.entries(
    evaluation.answers as Record<
      string,
      { value: string; count: number; correct: boolean }
    >
  ).reduce(
    (acc, [_, answer]) => ({
      ...acc,
      [answer.value]: { value: answer.value, count: answer.count },
    }),
    {}
  )

  return (
    <div className="h-40 space-y-2">
      <div className="font-bold">{t('pwa.practiceQuiz.othersAnswered')}</div>
      <Histogram
        data={{
          results: results,
          questionData: {
            options,
            __typename: 'NumericalQuestionData',
          } as NumericalQuestionData,
        }}
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
