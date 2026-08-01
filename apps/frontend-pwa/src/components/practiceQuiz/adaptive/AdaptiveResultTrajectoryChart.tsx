import {
  AdaptiveResultLevelBand,
  AdaptiveResultOverallPoint,
  AdaptiveResultTrajectoryPoint,
  describeAdaptiveTrajectoryPoint,
  prepareAdaptiveResultLevelBands,
  prepareAdaptiveResultTrajectory,
  summarizeAdaptiveTrajectory,
} from '@klicker-uzh/adaptive-learning'
import { useTranslations } from 'next-intl'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export const ADAPTIVE_BAND_COLORS = [
  '#ddeaf3',
  '#e8f0ea',
  '#fff4cc',
  '#fbe5e5',
  '#e5f3f6',
]

interface AdaptiveResultTrajectoryChartProps {
  levelBands: AdaptiveResultLevelBand[]
  trajectory: AdaptiveResultTrajectoryPoint[]
  overall: AdaptiveResultOverallPoint
}

function AdaptiveResultTrajectoryChart({
  levelBands,
  trajectory,
  overall,
}: AdaptiveResultTrajectoryChartProps) {
  const t = useTranslations()
  const bands = prepareAdaptiveResultLevelBands(levelBands)
  const points = prepareAdaptiveResultTrajectory({ trajectory, overall })
  const summary = summarizeAdaptiveTrajectory(points)

  if (points.length === 0) {
    return (
      <div
        className="border-l-4 border-slate-300 bg-slate-50 p-4 text-sm text-slate-700"
        data-cy="adaptive-result-trajectory-empty"
      >
        {t('pwa.practiceQuiz.adaptive.trajectory.noData')}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-cy="adaptive-result-trajectory">
      <div className="h-[300px] w-full" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height={300}
          initialDimension={{ width: 520, height: 300 }}
        >
          <ComposedChart
            data={points}
            accessibilityLayer={false}
            margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <CartesianGrid vertical={false} stroke="#d1d5db" />
            {bands.map((band, index) => (
              <ReferenceArea
                key={`${band.order}-${band.label}`}
                y1={band.startPosition}
                y2={band.endPosition}
                fill={ADAPTIVE_BAND_COLORS[index % ADAPTIVE_BAND_COLORS.length]}
                fillOpacity={0.82}
                strokeOpacity={0}
                ifOverflow="hidden"
              />
            ))}
            <XAxis
              dataKey="order"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              tickLine={false}
              label={{
                value: t('pwa.practiceQuiz.adaptive.trajectory.questionAxis'),
                position: 'insideBottom',
                offset: -8,
                fontSize: 12,
              }}
            />
            <YAxis hide domain={[0, 1]} />
            <Area
              type="monotone"
              dataKey="interval"
              stroke="none"
              fill="#0070b4"
              fillOpacity={0.18}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="position"
              stroke="#00589c"
              strokeWidth={3}
              isAnimationActive={false}
              connectNulls
              dot={(props) => {
                const { cx, cy, payload } = props as unknown as {
                  cx?: number
                  cy?: number
                  payload?: { isEndpoint?: boolean }
                }
                if (typeof cx !== 'number' || typeof cy !== 'number')
                  return <g />
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={payload?.isEndpoint ? 6 : 3}
                    fill={payload?.isEndpoint ? '#00589c' : '#ffffff'}
                    stroke="#00589c"
                    strokeWidth={payload?.isEndpoint ? 3 : 2}
                  />
                )
              }}
            />
            <Tooltip
              cursor={{ stroke: '#6b7280', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as
                  | (typeof points)[number]
                  | undefined
                if (!active || !point) return null
                const description = describeAdaptiveTrajectoryPoint(
                  point,
                  bands
                )
                return (
                  <div className="max-w-64 border bg-white p-3 text-sm shadow-sm">
                    <div className="font-semibold">
                      {t('pwa.practiceQuiz.adaptive.trajectory.question', {
                        number: description.question,
                      })}
                    </div>
                    <div>
                      {description.levelLabel ??
                        t('pwa.practiceQuiz.adaptive.profile.insufficientData')}
                    </div>
                    {description.lowerLevelLabel &&
                      description.upperLevelLabel && (
                        <div className="mt-1 text-slate-600">
                          {t(
                            'pwa.practiceQuiz.adaptive.trajectory.confidenceRange'
                          )}
                          {': '}
                          {description.lowerLevelLabel} -{' '}
                          {description.upperLevelLabel}
                        </div>
                      )}
                  </div>
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700">
        {bands.map((band, index) => (
          <li
            key={`${band.order}-${band.label}`}
            className="flex items-center gap-1.5"
          >
            <span
              className="h-3 w-5 shrink-0 border border-slate-300"
              style={{
                backgroundColor:
                  ADAPTIVE_BAND_COLORS[index % ADAPTIVE_BAND_COLORS.length],
              }}
              aria-hidden="true"
            />
            <span className="break-words">{band.label}</span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-slate-700" data-cy="adaptive-result-summary">
        {summary.finalLevelLabel
          ? t('pwa.practiceQuiz.adaptive.trajectory.summary', {
              count: summary.questionCount,
              level: summary.finalLevelLabel,
            })
          : t('pwa.practiceQuiz.adaptive.trajectory.incompleteSummary', {
              count: summary.questionCount,
            })}
      </p>

      <ol className="sr-only">
        {points.map((point) => {
          const description = describeAdaptiveTrajectoryPoint(point, bands)
          return (
            <li key={point.order}>
              {t('pwa.practiceQuiz.adaptive.trajectory.question', {
                number: description.question,
              })}
              {': '}
              {t('pwa.practiceQuiz.adaptive.trajectory.estimate')}
              {': '}
              {description.levelLabel ??
                t('pwa.practiceQuiz.adaptive.profile.insufficientData')}
              {'. '}
              {t('pwa.practiceQuiz.adaptive.trajectory.confidenceRange')}
              {': '}
              {description.lowerLevelLabel ??
                t('pwa.practiceQuiz.adaptive.profile.insufficientData')}{' '}
              -{' '}
              {description.upperLevelLabel ??
                t('pwa.practiceQuiz.adaptive.profile.insufficientData')}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default AdaptiveResultTrajectoryChart
