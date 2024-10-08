import type { InstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
  evaluation: InstanceEvaluation
}

function MCKPRIMEvaluation({ evaluation }: Props) {
  const t = useTranslations()
  const correctIx = evaluation.feedbacks
    ?.filter((choice) => choice.correct)
    .map((choice) => choice.ix)

  return (
    <div className="space-y-2">
      <div className="font-bold">{t('pwa.practiceQuiz.othersAnswered')}</div>
      {Object.entries(evaluation.choices as Record<string, number>).map(
        ([ix, value]) => (
          <Progress
            key={`kp-statistic-${ix}-${value}`}
            isMaxVisible={false}
            className={{
              root: twMerge('h-8', correctIx?.includes(+ix) && 'font-bold'),
              indicator: twMerge(
                'h-8',
                correctIx?.includes(+ix) ? 'bg-green-600' : 'bg-red-400'
              ),
            }}
            value={value ? (value / (evaluation.numAnswers ?? 1)) * 100 : 0}
            max={100}
            formatter={(v) => v.toFixed() + '%'}
          />
        )
      )}
    </div>
  )
}

export default MCKPRIMEvaluation
