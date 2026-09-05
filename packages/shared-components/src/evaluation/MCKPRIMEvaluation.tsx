import type { ChoicesInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Progress } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface Props {
  evaluation: ChoicesInstanceEvaluation
}

function MCKPRIMEvaluation({ evaluation }: Props) {
  const t = useTranslations()
  const correctIx = evaluation.feedbacks
    ?.filter((choice) => choice.correct)
    .map((choice) => choice.ix)

  return (
    <div className="space-y-2">
      <div className="font-bold">{t('pwa.practiceQuiz.othersAnswered')}</div>
      {evaluation.choices?.map((choice) => (
        <Progress
          key={`kp-statistic-${choice.ix}-${choice.count}`}
          isMaxVisible={false}
          className={{
            root: twMerge(
              'h-8',
              correctIx?.includes(+choice.ix) && 'font-bold'
            ),
            indicator: twMerge(
              'h-8',
              correctIx?.includes(+choice.ix) ? 'bg-green-600' : 'bg-red-400'
            ),
          }}
          value={
            choice.count
              ? (choice.count / (evaluation.numAnswers ?? 1)) * 100
              : 0
          }
          max={100}
          formatter={(v) => (v as number).toFixed() + '%'}
        />
      ))}
    </div>
  )
}

export default MCKPRIMEvaluation
