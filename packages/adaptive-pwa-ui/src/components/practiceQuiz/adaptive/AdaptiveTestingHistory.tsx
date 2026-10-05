import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { FAdaptivePracticeQuizTestingHistoryFragment } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  ADAPTIVE_COMPETENCE_MARKER_COLORS,
  getAdaptiveLevelBandColors,
  getAdaptiveLevelGroupEnds,
} from './adaptiveLevelPalette'
import { createEqualLevelScale } from './equalLevelScale'

type TestingHistory = FAdaptivePracticeQuizTestingHistoryFragment

const COMPETENCE_COLORS = ADAPTIVE_COMPETENCE_MARKER_COLORS

const WIDTH = 640
const MARGIN = { top: 8, right: 132, bottom: 22, left: 56 }

// Rendered only inside the testing box (ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true) on
// the question and result pages; the server returns no history otherwise.
// Collapsed by default so the solution stays the first thing testers see.
function AdaptiveTestingHistory({ history }: { history: TestingHistory }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  return (
    <details
      className="min-w-0"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      data-cy="adaptive-testing-history"
    >
      <summary
        className="focus-visible:outline-primary-80 flex cursor-pointer list-none items-center gap-2 rounded-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
        data-cy="adaptive-testing-history-toggle"
      >
        <FontAwesomeIcon
          icon={faChevronRight}
          className={`h-3 w-3 text-slate-500 transition-transform motion-reduce:transition-none ${
            open ? 'rotate-90' : ''
          }`}
          aria-hidden="true"
        />
        {t('pwa.practiceQuiz.adaptive.question.testingHistorySummary', {
          count: history.entries.length,
        })}
      </summary>
      <div className="mt-2">
        <AdaptiveTestingHistoryContent history={history} />
      </div>
    </details>
  )
}

function AdaptiveTestingHistoryContent({
  history,
}: {
  history: TestingHistory
}) {
  const t = useTranslations()
  const entries = history.entries
  if (entries.length === 0) {
    return (
      <p className="text-slate-600" data-cy="adaptive-testing-history-empty">
        {t('pwa.practiceQuiz.adaptive.question.testingHistoryEmpty')}
      </p>
    )
  }

  const competenceNames = [
    ...new Set(
      entries.flatMap(({ competenceName }) =>
        competenceName ? [competenceName] : []
      )
    ),
  ]
  const colorFor = (name: string | null | undefined) =>
    name
      ? COMPETENCE_COLORS[
          competenceNames.indexOf(name) % COMPETENCE_COLORS.length
        ]!
      : '#475569'
  const showOverall = entries.some(
    ({ overallTheta }) => typeof overallTheta === 'number'
  )

  return (
    <div className="space-y-2" data-cy="adaptive-testing-history-content">
      <AdaptiveTestingHistoryChart
        history={history}
        colorFor={colorFor}
        showOverall={showOverall}
      />
      <div className="max-h-72 overflow-auto rounded border border-amber-200 bg-white">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-amber-100 text-slate-700">
            <tr>
              <th className="px-2 py-1">
                {t('pwa.practiceQuiz.adaptive.question.testingHistoryOrder')}
              </th>
              <th className="px-2 py-1">
                {t('pwa.practiceQuiz.adaptive.question.testingHistoryElement')}
              </th>
              <th className="px-2 py-1">
                {t('pwa.practiceQuiz.adaptive.question.testingHistoryArea')}
              </th>
              <th className="px-2 py-1">
                {t(
                  'pwa.practiceQuiz.adaptive.question.testingHistoryItemLevel'
                )}
              </th>
              <th className="px-2 py-1">
                {t('pwa.practiceQuiz.adaptive.question.testingHistoryResult')}
              </th>
              {showOverall && (
                <th className="px-2 py-1">
                  {t(
                    'pwa.practiceQuiz.adaptive.question.testingHistoryOverall'
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.order}
                className="border-t border-amber-100 align-top"
                data-cy={`adaptive-testing-history-row-${entry.order}`}
              >
                <td className="px-2 py-1">{entry.order}</td>
                <td className="break-all px-2 py-1">{entry.elementTitle}</td>
                <td className="px-2 py-1">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: colorFor(entry.competenceName) }}
                    aria-hidden="true"
                  />
                  {[entry.competenceName, entry.subcompetenceName]
                    .filter(Boolean)
                    .join(' › ') || '–'}
                </td>
                <td className="px-2 py-1 font-medium">
                  {entry.itemLevelLabel ?? '–'}
                </td>
                <td
                  className={`px-2 py-1 ${
                    entry.result === 'CORRECT'
                      ? 'text-green-800'
                      : entry.result === 'INCORRECT'
                        ? 'text-red-800'
                        : 'text-amber-800'
                  }`}
                >
                  {t(
                    `pwa.practiceQuiz.adaptive.question.testingResult.${entry.result}`
                  )}
                  {entry.result === 'PARTIALLY_CORRECT' &&
                    ` (${Math.round(entry.score * 100)}%)`}
                </td>
                {showOverall && (
                  <td className="px-2 py-1">
                    {typeof entry.overallTheta === 'number'
                      ? entry.overallTheta.toFixed(2)
                      : '–'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdaptiveTestingHistoryChart({
  history,
  colorFor,
  showOverall,
}: {
  history: TestingHistory
  colorFor: (name: string | null | undefined) => string
  showOverall: boolean
}) {
  const t = useTranslations()
  const { bands, project } = createEqualLevelScale(history.levelBands)
  const bandColors = getAdaptiveLevelBandColors(bands)
  const groupEnds = getAdaptiveLevelGroupEnds(bands)
  const entries = history.entries
  const rowHeight = bands.length > 12 ? 12 : 16
  const plotHeight = Math.max(120, bands.length * rowHeight)
  const height = MARGIN.top + plotHeight + MARGIN.bottom
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right
  const maxOrder = Math.max(...entries.map(({ order }) => order))
  const minOrder = Math.min(...entries.map(({ order }) => order))
  const x = (order: number) =>
    MARGIN.left +
    (maxOrder === minOrder
      ? plotWidth / 2
      : ((order - minOrder) / (maxOrder - minOrder)) * plotWidth)
  const y = (position: number) =>
    MARGIN.top + (1 - project(position)) * plotHeight
  // Keep the right-hand estimate labels from overlapping.
  const labelYs = new Map<string, number>()
  let previousLabelY = Number.NEGATIVE_INFINITY
  for (const estimate of history.competenceEstimates
    .filter((candidate) => typeof candidate.position === 'number')
    .slice()
    .sort((a, b) => b.position! - a.position!)) {
    const labelY = Math.max(y(estimate.position!), previousLabelY + 11)
    labelYs.set(estimate.name, labelY)
    previousLabelY = labelY
  }
  const overallPoints = entries.flatMap((entry) =>
    typeof entry.overallPosition === 'number'
      ? [`${x(entry.order)},${y(entry.overallPosition)}`]
      : []
  )

  return (
    <figure className="space-y-1" data-cy="adaptive-testing-history-chart">
      <figcaption className="font-medium">
        {t('pwa.practiceQuiz.adaptive.question.testingHistoryChart')}
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full rounded border border-amber-200 bg-white"
        role="img"
        aria-label={t('pwa.practiceQuiz.adaptive.question.testingHistoryChart')}
      >
        {bands.map((band, index) => {
          const top = MARGIN.top + (1 - band.endPosition) * plotHeight
          const bandHeight =
            (band.endPosition - band.startPosition) * plotHeight
          return (
            <g key={`${band.order}-${band.label}`}>
              <rect
                x={MARGIN.left}
                y={top}
                width={plotWidth}
                height={bandHeight}
                fill={bandColors[index]}
                stroke="#ffffff"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 4}
                y={top + bandHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fill="#334155"
              >
                {band.label.length > 10
                  ? `${band.label.slice(0, 9)}…`
                  : band.label}
              </text>
            </g>
          )
        })}
        {bands.map((band, index) => {
          if (!groupEnds[index]) return null
          // Wider separator above the last band of a main level.
          const lineY = MARGIN.top + (1 - band.endPosition) * plotHeight
          return (
            <line
              key={`group-${band.order}-${band.label}`}
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={lineY}
              y2={lineY}
              stroke="#ffffff"
              strokeWidth={2.5}
            />
          )
        })}
        {history.competenceEstimates.map((estimate) => {
          if (typeof estimate.position !== 'number') return null
          const own = entries.filter(
            ({ competenceName }) => competenceName === estimate.name
          )
          const from = own[0]?.order ?? minOrder
          const to = own.at(-1)?.order ?? maxOrder
          const lineY = y(estimate.position)
          return (
            <g key={estimate.name}>
              <line
                x1={x(from) - 4}
                x2={x(to) + 4}
                y1={lineY}
                y2={lineY}
                stroke={colorFor(estimate.name)}
                strokeWidth={2}
                strokeDasharray="5 3"
              />
              <text
                x={MARGIN.left + plotWidth + 6}
                y={labelYs.get(estimate.name) ?? lineY}
                dominantBaseline="middle"
                fontSize={9}
                fill={colorFor(estimate.name)}
              >
                {`${truncate(estimate.name, 12)} ${t(
                  'pwa.practiceQuiz.adaptive.question.testingHistoryCurrentEstimate',
                  { level: estimate.levelLabel ?? '–' }
                )}`}
              </text>
            </g>
          )
        })}
        {showOverall && overallPoints.length > 1 && (
          <polyline
            points={overallPoints.join(' ')}
            fill="none"
            stroke="#334155"
            strokeWidth={1.5}
          />
        )}
        {entries.map((entry) => {
          if (typeof entry.itemLevelPosition !== 'number') return null
          const cx = x(entry.order)
          const cy = y(entry.itemLevelPosition)
          const color = colorFor(entry.competenceName)
          return (
            <g key={entry.order}>
              <title>
                {`#${entry.order} ${entry.itemLevelLabel ?? ''} · ${t(
                  `pwa.practiceQuiz.adaptive.question.testingResult.${entry.result}`
                )}`}
              </title>
              <circle
                cx={cx}
                cy={cy}
                r={4}
                fill={entry.result === 'CORRECT' ? color : '#ffffff'}
                stroke={color}
                strokeWidth={1.5}
              />
              {entry.result === 'PARTIALLY_CORRECT' && (
                <path
                  d={`M ${cx} ${cy - 4} A 4 4 0 0 0 ${cx} ${cy + 4} Z`}
                  fill={color}
                />
              )}
            </g>
          )
        })}
        {entries.map((entry) => (
          <text
            key={`x-${entry.order}`}
            x={x(entry.order)}
            y={MARGIN.top + plotHeight + 14}
            textAnchor="middle"
            fontSize={9}
            fill="#475569"
          >
            {entry.order}
          </text>
        ))}
      </svg>
      <p className="text-xs text-slate-600">
        {t('pwa.practiceQuiz.adaptive.question.testingHistoryChartNote')}
      </p>
    </figure>
  )
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

export default AdaptiveTestingHistory
