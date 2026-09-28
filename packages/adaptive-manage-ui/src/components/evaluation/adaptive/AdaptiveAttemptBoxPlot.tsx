import { useFormatter, useTranslations } from 'next-intl'
import type { AdaptivePilotMetrics } from './types'
import { formatDuration } from './formatDuration'

type Distribution = NonNullable<AdaptivePilotMetrics['questionCountBoxPlot']>

function AdaptiveAttemptBoxPlot({
  distribution,
  duration = false,
}: {
  distribution: Distribution | null | undefined
  duration?: boolean
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const prefix = 'manage.evaluation.adaptive.pilot'
  const title = t(
    `${prefix}.${duration ? 'timeDistribution' : 'questionDistribution'}`
  )
  const unit = duration ? t(`${prefix}.boxPlotTimeFormat`) : title
  const format = (value: number) =>
    duration
      ? formatDuration(value)
      : formatter.number(value, { maximumFractionDigits: 2 })
  const maximum = distribution ? Math.max(1, Math.ceil(distribution.max)) : 1
  const x = (value: number) => 48 + (value / maximum) * 504
  const values = distribution
    ? ([
        ['boxPlotMin', distribution.min],
        ['boxPlotQ1', distribution.q1],
        ['boxPlotMedian', distribution.median],
        ['boxPlotQ3', distribution.q3],
        ['boxPlotMax', distribution.max],
      ] as const)
    : []
  return (
    <figure
      className="min-w-0 rounded border border-gray-200 p-4"
      data-cy={
        duration
          ? 'adaptive-completion-time-boxplot'
          : 'adaptive-question-count-boxplot'
      }
    >
      <figcaption className="font-semibold">
        {title}
        {duration && distribution ? ` (${unit})` : ''}
      </figcaption>
      {distribution ? (
        <>
          <p className="mt-1 text-sm text-gray-600">
            {t(`${prefix}.boxPlotCount`, { count: distribution.count })}
          </p>
          <svg
            viewBox="0 0 600 120"
            className="mt-3 w-full text-uzh-blue-100"
            role="img"
            aria-label={`${title}: ${values.map(([key, value]) => `${t(`${prefix}.${key}`)} ${format(value)}`).join(', ')} (${unit})`}
          >
            <line
              x1={x(distribution.min)}
              x2={x(distribution.max)}
              y1="40"
              y2="40"
              stroke="currentColor"
              strokeWidth="2"
            />
            {[distribution.min, distribution.max].map((value, i) => (
              <line
                key={i}
                x1={x(value)}
                x2={x(value)}
                y1="26"
                y2="54"
                stroke="currentColor"
                strokeWidth="2"
              />
            ))}
            <rect
              x={x(distribution.q1)}
              y="18"
              width={x(distribution.q3) - x(distribution.q1)}
              height="44"
              fill="currentColor"
              fillOpacity="0.15"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1={x(distribution.median)}
              x2={x(distribution.median)}
              y1="18"
              y2="62"
              stroke="currentColor"
              strokeWidth="4"
            />
            <line
              x1="48"
              x2="552"
              y1="82"
              y2="82"
              className="stroke-gray-300"
            />
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line
                  x1={48 + i * 126}
                  x2={48 + i * 126}
                  y1="82"
                  y2="87"
                  className="stroke-gray-400"
                />
                <text
                  x={48 + i * 126}
                  y="110"
                  textAnchor="middle"
                  fontSize="16"
                  className="fill-gray-600"
                >
                  {format((maximum * i) / 4)}
                </text>
              </g>
            ))}
          </svg>
          <p className="text-center text-xs text-gray-600">{unit}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {values.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-gray-600">
                  {t(`${prefix}.${key}`)}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {format(value)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-gray-600">
            {t(`${prefix}.boxPlotHelp`)}
          </p>
        </>
      ) : (
        <p className="py-6 text-sm text-gray-600">
          {t(`${prefix}.boxPlotEmpty`)}
        </p>
      )}
      {duration && (
        <p className="mt-2 text-xs text-gray-600">
          {t(`${prefix}.boxPlotDurationNote`)}
        </p>
      )}
    </figure>
  )
}
export default AdaptiveAttemptBoxPlot
