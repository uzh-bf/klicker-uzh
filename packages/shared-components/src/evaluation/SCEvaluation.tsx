import React from 'react'
import type { InstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface Props {
  evaluation: InstanceEvaluation
}

function SCEvaluation({ evaluation }: Props) {
  const t = useTranslations()

  const sum = Object.values(
    evaluation.choices as Record<string, number>
  ).reduce((acc, choice) => acc + choice, 0)
  const correctIx = evaluation.feedbacks?.findIndex((choice) => choice.correct)

  return (
    <div className="space-y-2">
      <div className="font-bold">{t('pwa.practiceQuiz.othersAnswered')}</div>
      {Object.entries(evaluation.choices as Record<string, number>).map(
        ([ix, value]) => (
          <Progress
            isMaxVisible={false}
            className={{
              root: twMerge(
                'h-8',
                parseInt(ix) == correctIx && 'font-bold text-green-600'
              ),
              indicator: twMerge(
                'h-8',
                parseInt(ix) == correctIx ? 'bg-green-600' : 'bg-gray-400'
              ),
            }}
            key={`choice-statistic-${ix}-${value}`}
            value={(value / sum) * 100}
            max={100}
            formatter={(v) => v.toFixed() + '%'}
          />
        )
      )}
    </div>
  )
}

export default SCEvaluation
