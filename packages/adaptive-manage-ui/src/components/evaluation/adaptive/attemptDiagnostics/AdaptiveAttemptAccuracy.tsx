import type { QAdaptivePracticeQuizAttemptDiagnosticsQuery } from '@klicker-uzh/graphql/dist/ops'
import { useFormatter, useTranslations } from 'next-intl'

type Accuracy = NonNullable<
  QAdaptivePracticeQuizAttemptDiagnosticsQuery['adaptivePracticeQuizAttemptDiagnostics']
>['accuracy']

// How well the adaptive results matched the lecturer's reviews.
function AdaptiveAttemptAccuracy({ accuracy }: { accuracy: Accuracy }) {
  const t = useTranslations()
  const formatter = useFormatter()
  const percent = (value: number | null | undefined) =>
    typeof value === 'number'
      ? formatter.number(value, { style: 'percent', maximumFractionDigits: 0 })
      : '–'
  const signed = (value: number | null | undefined) =>
    typeof value === 'number'
      ? `${value > 0 ? '+' : ''}${formatter.number(value, {
          maximumFractionDigits: 1,
        })}`
      : '–'

  if (accuracy.reviewedAttempts === 0) {
    return (
      <p className="mb-2 text-sm text-gray-600" data-cy="adaptive-accuracy">
        {t('manage.evaluation.adaptive.attemptDiagnostics.accuracy.none')}
      </p>
    )
  }
  const metrics = [
    {
      key: 'reviewed',
      value: String(accuracy.reviewedAttempts),
    },
    {
      key: 'asExpected',
      value: percent(accuracy.asExpected / accuracy.reviewedAttempts),
    },
    { key: 'exact', value: percent(accuracy.exactShare) },
    { key: 'withinOne', value: percent(accuracy.withinOneLevelShare) },
    { key: 'meanDifference', value: signed(accuracy.meanLevelDifference) },
  ] as const

  return (
    <div className="mb-3" data-cy="adaptive-accuracy">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {metrics.map(({ key, value }) => (
          <div key={key} className="rounded border border-gray-200 px-3 py-2">
            <dt className="text-xs text-gray-600">
              {t(
                `manage.evaluation.adaptive.attemptDiagnostics.accuracy.${key}`
              )}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-xs text-gray-600">
        {t('manage.evaluation.adaptive.attemptDiagnostics.accuracy.help', {
          comparisons: accuracy.levelComparisons,
          tooHigh: accuracy.tooHigh,
          tooLow: accuracy.tooLow,
          unsure: accuracy.unsure,
        })}
      </p>
    </div>
  )
}

export default AdaptiveAttemptAccuracy
