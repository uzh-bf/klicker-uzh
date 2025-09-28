import type {
  ActivityStudentPerformance,
  ActivityType,
} from '@klicker-uzh/types'
import { useFormatter, useTranslations } from 'next-intl'
import PointsCard from './PointsCard'

function AssessmentResultsList({
  results,
}: {
  results: ActivityStudentPerformance[]
  type: ActivityType
}) {
  const t = useTranslations('pwa.assessment')
  const formatter = useFormatter()

  const formatNumber = (value: number, includeSign?: boolean) => {
    const formattedValue = formatter.number(value, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    })

    if (includeSign) {
      return value >= 0
        ? `+ ${formattedValue}`
        : `- ${formattedValue.replace('-', '')}`
    }

    return formattedValue
  }

  const formatFinishedAt = (
    finishedAt: ActivityStudentPerformance['finishedAt']
  ) => {
    const finishedAtDate = new Date(finishedAt)
    if (!finishedAt || Number.isNaN(finishedAtDate.getTime())) {
      return t('notCompletedYet')
    }

    return t('completedOn', {
      date: formatter.dateTime(finishedAtDate, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    })
  }

  const aggregated = results.reduce(
    (acc, result) => {
      acc.basePoints += result.basePoints
      acc.availableBasePoints += result.availableBasePoints
      acc.correctnessPoints += result.correctnessPoints
      acc.availableCorrectnessPoints += result.availableCorrectnessPoints
      acc.bonusPoints += result.bonusPoints
      acc.availableBonusPoints += result.availableBonusPoints
      acc.totalPoints +=
        result.basePoints + result.correctnessPoints + result.bonusPoints
      acc.availableTotalPoints +=
        result.availableBasePoints +
        result.availableCorrectnessPoints +
        result.availableBonusPoints
      return acc
    },
    {
      basePoints: 0,
      availableBasePoints: 0,
      correctnessPoints: 0,
      availableCorrectnessPoints: 0,
      bonusPoints: 0,
      availableBonusPoints: 0,
      totalPoints: 0,
      availableTotalPoints: 0,
    }
  )

  return (
    <div className="mt-3 space-y-4">
      {results.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-md">
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            {t('aggregatedTitle')}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PointsCard
              variant="summary"
              label={t('basePoints')}
              value={formatNumber(aggregated.basePoints)}
              meta={t('ofAvailable', {
                value: formatNumber(aggregated.availableBasePoints),
              })}
            />
            <PointsCard
              variant="summary"
              label={t('correctnessPoints')}
              value={formatNumber(aggregated.correctnessPoints)}
              meta={t('ofAvailable', {
                value: formatNumber(aggregated.availableCorrectnessPoints),
              })}
            />
            <PointsCard
              variant="summary"
              label={t('bonusPoints')}
              value={formatNumber(aggregated.bonusPoints)}
              meta={t('ofAvailable', {
                value: formatNumber(aggregated.availableBonusPoints),
              })}
            />
            <PointsCard
              variant="summary"
              label={t('totalPoints')}
              value={formatNumber(aggregated.totalPoints)}
              meta={`${t('ofAvailable', {
                value: formatNumber(aggregated.availableTotalPoints),
              })} ${t('excludingBonus', { value: formatNumber(aggregated.availableBasePoints + aggregated.availableCorrectnessPoints) })}`}
            />
          </div>
        </div>
      )}

      {results.map((result) => (
        <div
          key={result.id}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-base font-semibold text-slate-900">
              {result.displayName}
            </div>
            <div className="text-sm text-slate-500">
              {formatFinishedAt(result.finishedAt)}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PointsCard
              label={t('basePoints')}
              value={formatNumber(result.basePoints)}
              meta={t('ofAvailable', {
                value: formatNumber(result.availableBasePoints),
              })}
            />
            <PointsCard
              label={t('correctnessPoints')}
              value={formatNumber(result.correctnessPoints)}
              meta={t('ofAvailable', {
                value: formatNumber(result.availableCorrectnessPoints),
              })}
            />
            <PointsCard
              label={t('bonusPoints')}
              value={formatNumber(result.bonusPoints)}
              meta={t('ofAvailable', {
                value: formatNumber(result.availableBonusPoints),
              })}
            />
            <PointsCard
              label={t('totalPoints')}
              value={formatNumber(
                result.basePoints +
                  result.correctnessPoints +
                  result.bonusPoints
              )}
              meta={t('ofAvailable', {
                value: formatNumber(
                  result.availableBasePoints +
                    result.availableCorrectnessPoints +
                    result.availableBonusPoints
                ),
              })}
            />
          </div>

          {result.corrections.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-bold">{t('corrections')}</div>
              <ul className="ml-4 list-disc">
                {result.corrections.map((correction) => {
                  const baseCorrection =
                    (correction.awardedBasePoints ?? 0) -
                    (correction.deductedBasePoints ?? 0)
                  const correctnessCorrection =
                    (correction.awardedCorrectnessPoints ?? 0) -
                    (correction.deductedCorrectnessPoints ?? 0)
                  const bonusCorrection =
                    (correction.awardedBonusPoints ?? 0) -
                    (correction.deductedBonusPoints ?? 0)
                  const totalCorrection =
                    (correction.awardedBasePoints ?? 0) +
                    (correction.awardedCorrectnessPoints ?? 0) +
                    (correction.awardedBonusPoints ?? 0) -
                    (correction.deductedBasePoints ?? 0) -
                    (correction.deductedCorrectnessPoints ?? 0) -
                    (correction.deductedBonusPoints ?? 0)

                  if (
                    baseCorrection === 0 &&
                    correctnessCorrection === 0 &&
                    bonusCorrection === 0
                  ) {
                    return (
                      <li key={`point-correction-${correction.id}`}>
                        {t('noPointsCorrection', { reason: correction.reason })}
                      </li>
                    )
                  } else {
                    return (
                      <li key={`point-correction-${correction.id}`}>
                        {t('nonZeroPointCorrection', {
                          points: formatNumber(totalCorrection, true),
                          basePoints: formatNumber(baseCorrection, true),
                          correctnessPoints: formatNumber(
                            correctnessCorrection,
                            true
                          ),
                          bonusPoints: formatNumber(bonusCorrection, true),
                          reason: correction.reason,
                        })}
                      </li>
                    )
                  }
                })}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default AssessmentResultsList
