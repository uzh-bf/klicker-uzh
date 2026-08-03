import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { AdaptiveCohortDistribution } from './types'

const BAR_COLORS = [
  'bg-uzh-blue-100',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-violet-500',
]

const STATUS_COLORS = {
  betweenLevels: 'bg-sky-600',
  insufficientEvidence: 'bg-gray-500',
  poolLimited: 'bg-amber-600',
  researchOnly: 'bg-gray-700',
} as const

function AdaptiveDistributionBars({
  distribution,
  dataCy,
}: {
  distribution: AdaptiveCohortDistribution
  dataCy: string
}) {
  const t = useTranslations()

  if (distribution.suppressed) {
    return (
      <UserNotification
        type="info"
        message={t('manage.evaluation.adaptive.suppression.distribution')}
        data={{ cy: `${dataCy}-suppressed` }}
      />
    )
  }

  const buckets = distribution.buckets
    .toSorted((left, right) => left.levelOrder - right.levelOrder)
    .map((bucket, index) => ({
      label: bucket.levelLabel,
      count: bucket.count,
      color: BAR_COLORS[index % BAR_COLORS.length],
    }))

  const resultStatusBuckets = [
    {
      key: 'betweenLevels',
      count: distribution.betweenLevelsCount,
    },
    {
      key: 'insufficientEvidence',
      count: distribution.insufficientEvidenceCount,
    },
    {
      key: 'poolLimited',
      count: distribution.poolLimitedCount,
    },
    {
      key: 'researchOnly',
      count: distribution.researchOnlyCount,
    },
  ] as const
  const hasVersionedResultStatuses = resultStatusBuckets.some(
    (bucket) => typeof bucket.count === 'number'
  )

  if (hasVersionedResultStatuses) {
    for (const bucket of resultStatusBuckets) {
      if (typeof bucket.count === 'number' && bucket.count > 0) {
        buckets.push({
          label: t(
            `manage.evaluation.adaptive.distributionStatuses.${bucket.key}`
          ),
          count: bucket.count,
          color: STATUS_COLORS[bucket.key],
        })
      }
    }
  } else if (typeof distribution.insufficientDataCount === 'number') {
    buckets.push({
      label: t('manage.evaluation.adaptive.insufficientData'),
      count: distribution.insufficientDataCount,
      color: 'bg-gray-500',
    })
  }

  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)

  if (total === 0) {
    return (
      <p className="text-sm text-gray-600" data-cy={`${dataCy}-empty`}>
        {t('manage.evaluation.adaptive.noDistributionData')}
      </p>
    )
  }

  return (
    <ul className="space-y-2" data-cy={dataCy}>
      {buckets.map((bucket) => {
        const percentage = (bucket.count / total) * 100

        return (
          <li
            key={bucket.label}
            className="grid grid-cols-[minmax(6rem,10rem)_1fr_2.5rem] items-center gap-2 text-sm"
          >
            <span className="truncate" title={bucket.label}>
              {bucket.label}
            </span>
            <div
              className="h-4 overflow-hidden rounded-sm bg-gray-100"
              role="img"
              aria-label={t('manage.evaluation.adaptive.distributionBarLabel', {
                level: bucket.label,
                count: bucket.count,
              })}
            >
              <div
                className={`h-full ${bucket.color}`}
                style={{
                  width: `${percentage}%`,
                  minWidth: bucket.count > 0 ? '0.25rem' : undefined,
                }}
              />
            </div>
            <span className="text-right font-medium tabular-nums">
              {bucket.count}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default AdaptiveDistributionBars
