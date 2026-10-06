import {
  type AdaptiveResultLevelBand,
  type AdaptiveResultOverallPoint,
  type AdaptiveResultTrajectoryPoint,
  describeAdaptiveTrajectoryPoint,
  prepareAdaptiveResultTrajectory,
  summarizeAdaptiveTrajectory,
} from '@klicker-uzh/adaptive-contract'
import { useTranslations } from 'next-intl'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ADAPTIVE_LEVEL_MARKER_COLOR,
  getAdaptiveLevelBandColors,
  getAdaptiveLevelGroupEnds,
} from './adaptiveLevelPalette'
import { createEqualLevelScale } from './equalLevelScale'

interface AdaptiveResultTrajectoryChartProps {
  levelBands: AdaptiveResultLevelBand[]
  trajectory: AdaptiveResultTrajectoryPoint[]
  overall: AdaptiveResultOverallPoint
  /** Edge- and tolerance-aware level name; defaults to the band label. */
  formatLevel?: (levelLabel: string) => string
  /** Edge-aware range text; defaults to "lower - upper". */
  formatRange?: (lowerLevelLabel: string, upperLevelLabel: string) => string
  /** Caption below the chart; defaults to the trajectory summary. */
  summaryText?: string
}

function AdaptiveResultTrajectoryChart({
  levelBands,
  trajectory,
  overall,
  formatLevel = (levelLabel) => levelLabel,
  formatRange = (lower, upper) => `${lower} - ${upper}`,
  summaryText,
}: AdaptiveResultTrajectoryChartProps) {
  const t = useTranslations()
  const { bands, project } = createEqualLevelScale(levelBands)
  const bandColors = getAdaptiveLevelBandColors(bands)
  const groupEnds = getAdaptiveLevelGroupEnds(bands)
  const points = prepareAdaptiveResultTrajectory({ trajectory, overall }).map(
    (point) => {
      const lowerPosition = project(point.lowerPosition)
      const upperPosition = project(point.upperPosition)
      return {
        ...point,
        position: project(point.position),
        lowerPosition,
        upperPosition,
        interval: [lowerPosition, upperPosition] as [number, number],
      }
    }
  )
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
      <p className="text-sm text-slate-600">
        {t('pwa.practiceQuiz.adaptive.trajectory.evidenceHelp')}
      </p>
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
                fill={bandColors[index]}
                fillOpacity={1}
                stroke="#ffffff"
                strokeWidth={1}
                ifOverflow="hidden"
              />
            ))}
            {bands.map((band, index) =>
              groupEnds[index] ? (
                <ReferenceLine
                  key={`group-${band.order}-${band.label}`}
                  y={band.endPosition}
                  stroke="#ffffff"
                  strokeWidth={3}
                  ifOverflow="hidden"
                />
              ) : null
            )}
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
            <YAxis
              domain={[0, 1]}
              ticks={bands.map(
                (band) => (band.startPosition + band.endPosition) / 2
              )}
              tickFormatter={(value) => {
                const label =
                  bands.find(
                    (band) =>
                      value >= band.startPosition && value < band.endPosition
                  )?.label ?? ''
                return label.length > 8 ? `${label.slice(0, 7)}…` : label
              }}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
              interval={0}
            />
            <Area
              type="linear"
              dataKey="interval"
              stroke={ADAPTIVE_LEVEL_MARKER_COLOR}
              strokeOpacity={0.7}
              strokeWidth={1}
              fill={ADAPTIVE_LEVEL_MARKER_COLOR}
              fillOpacity={0.16}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="linear"
              dataKey="position"
              stroke={ADAPTIVE_LEVEL_MARKER_COLOR}
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
                    fill={
                      payload?.isEndpoint
                        ? ADAPTIVE_LEVEL_MARKER_COLOR
                        : '#ffffff'
                    }
                    stroke={ADAPTIVE_LEVEL_MARKER_COLOR}
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
                      {description.levelLabel
                        ? formatLevel(description.levelLabel)
                        : t(
                            'pwa.practiceQuiz.adaptive.trajectory.notYetDetermined'
                          )}
                    </div>
                    {description.lowerLevelLabel &&
                      description.upperLevelLabel && (
                        <div className="mt-1 text-slate-600">
                          {t(
                            'pwa.practiceQuiz.adaptive.trajectory.confidenceRange'
                          )}
                          {': '}
                          {formatRange(
                            description.lowerLevelLabel,
                            description.upperLevelLabel
                          )}
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
                backgroundColor: bandColors[index],
              }}
              aria-hidden="true"
            />
            <span className="break-words">{band.label}</span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-slate-700" data-cy="adaptive-result-summary">
        {summaryText ??
          (summary.finalLevelLabel
            ? t('pwa.practiceQuiz.adaptive.trajectory.summary', {
                count: summary.questionCount,
                level: formatLevel(summary.finalLevelLabel),
              })
            : t('pwa.practiceQuiz.adaptive.trajectory.incompleteSummary', {
                count: summary.questionCount,
              }))}
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
              {description.levelLabel
                ? formatLevel(description.levelLabel)
                : t('pwa.practiceQuiz.adaptive.trajectory.notYetDetermined')}
              {'. '}
              {t('pwa.practiceQuiz.adaptive.trajectory.confidenceRange')}
              {': '}
              {description.lowerLevelLabel && description.upperLevelLabel
                ? formatRange(
                    description.lowerLevelLabel,
                    description.upperLevelLabel
                  )
                : t('pwa.practiceQuiz.adaptive.trajectory.notYetDetermined')}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default AdaptiveResultTrajectoryChart
