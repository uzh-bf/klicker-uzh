import {
  FreeTextQuestionOptions,
  InstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import React from 'react'

interface Props {
  options: FreeTextQuestionOptions
  evaluation: InstanceEvaluation
}

function FTEvaluation({ options, evaluation }: Props) {
  const t = useTranslations()

  const answers = Object.entries(
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
  ) as Record<string, Record<string, string | number>>
  const solutions = options.solutions ? options.solutions : []

  return (
    <div>
      <div className="mb-4">
        <div className="font-bold">{t('pwa.practiceQuiz.othersAnswered')}</div>
        <div>
          {Object.keys(answers)
            .map((key) => `${key} (${answers[key].count})`)
            .join(', ')}
        </div>
      </div>
      {solutions.length > 0 && (
        <div>
          <div className="font-bold">{t('shared.generic.sampleSolution')}</div>
          <div>{solutions.join(', ')}</div>
        </div>
      )}
    </div>
  )
}

export default FTEvaluation
