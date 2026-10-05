import { useTranslations } from 'next-intl'
import { summarizeAdaptiveDistributionCoverage } from './adaptiveDistributionCoverage'
import type { AdaptiveCohortDistribution } from './types'

function AdaptiveEstimatedDistribution({
  distribution,
  cohortSize,
  dataCy,
}: {
  distribution: AdaptiveCohortDistribution
  cohortSize: number | null
  dataCy: string
}) {
  const t = useTranslations('manage.evaluation.adaptive.distributionEstimates')
  const buckets = distribution.buckets.toSorted(
    (a, b) => a.levelOrder - b.levelOrder
  )
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const { notTested, withoutUsableEstimate: excluded } =
    summarizeAdaptiveDistributionCoverage({
      cohortSize,
      estimatedCount: total,
      notTestedCount: distribution.notTestedCount,
    })
  return (
    <div className="space-y-3" data-cy={dataCy}>
      <p className="text-sm text-gray-600">{t('description')}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 bg-uzh-blue-100" aria-hidden="true" />
          {t('determined')}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-3 bg-uzh-blue-100 opacity-30"
            aria-hidden="true"
          />
          {t('provisional')}
        </span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-gray-600">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {buckets.map((bucket) => {
            const determined = bucket.determinedCount
            const provisional = bucket.count - determined
            const label = t('barLabel', {
              level: bucket.levelLabel,
              determined,
              provisional,
            })
            return (
              <li
                key={bucket.levelOrder}
                className="grid grid-cols-[minmax(3rem,6rem)_1fr_3rem] items-center gap-x-3 gap-y-1 text-sm"
              >
                <span>{bucket.levelLabel}</span>
                <div
                  className="flex h-5 overflow-hidden rounded-sm bg-gray-100"
                  role="img"
                  aria-label={label}
                  title={label}
                >
                  <div
                    className="h-full bg-uzh-blue-100"
                    style={{ width: `${(100 * determined) / total}%` }}
                  />
                  <div
                    className="h-full bg-uzh-blue-100 opacity-30"
                    style={{ width: `${(100 * provisional) / total}%` }}
                  />
                </div>
                <span className="text-right font-medium tabular-nums">
                  {bucket.count}
                </span>
                <span className="col-start-2 col-span-2 text-xs text-gray-600">
                  {t('counts', { determined, provisional })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-sm text-gray-600">{t('included', { count: total })}</p>
      {notTested !== null && notTested > 0 ? (
        <p className="text-sm text-gray-600" data-cy={`${dataCy}-not-tested`}>
          {t('notTested', { count: notTested })}
        </p>
      ) : null}
      {excluded !== null && excluded > 0 ? (
        <p className="text-sm text-gray-600" data-cy={`${dataCy}-excluded`}>
          {t('excluded', { count: excluded })}
        </p>
      ) : null}
    </div>
  )
}
export default AdaptiveEstimatedDistribution
