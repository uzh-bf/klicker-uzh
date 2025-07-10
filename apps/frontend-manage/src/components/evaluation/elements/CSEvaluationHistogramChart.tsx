import {
  CHART_COLORS,
  CHART_SOLUTION_COLORS,
} from '@klicker-uzh/shared-components/src/constants'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TextSizeType } from '../textSizes'
import getLabelForValue from './getLabelForValue'

function CSEvaluationHistogramChart({
  histogramData,
  solutionData,
  histogramKeys,
  criterionMin,
  criterionMax,
  criterionName,
  criterionLabels,
  textSize,
}: {
  histogramData: {
    value: number
    label: string
    exactBinMatch: boolean
    [dataIx: string]: number | string | boolean
  }[]
  solutionData?: {
    [dataIx: string]: { min: number; max: number } | undefined
  }
  histogramKeys: string[]
  criterionMin: number
  criterionMax: number
  criterionName: string
  criterionLabels?: { min: string; mid?: string | null; max: string } | null
  textSize: TextSizeType
}) {
  const t = useTranslations()
  const { minValue, maxValue } = histogramData.reduce(
    (acc, { value }) => {
      if (value < acc.minValue) {
        acc.minValue = value
      }
      if (value > acc.maxValue) {
        acc.maxValue = value
      }
      return acc
    },
    { minValue: Number.MAX_VALUE, maxValue: Number.MIN_VALUE }
  )

  // compute the precision of the x-axis such that always at least 5 ticks are shown
  const precision = -Math.floor(Math.log10((maxValue - minValue) / 5))

  // check if labels exist for the criterion
  const hasLabels = !!(criterionLabels?.min && criterionLabels?.max)

  // for step / likert criteria, set the tick values for min, mid, max
  const tickValues = hasLabels
    ? criterionLabels?.mid
      ? [criterionMin, (criterionMin + criterionMax) / 2, criterionMax]
      : [criterionMin, criterionMax]
    : histogramData.map(
        (d) => Math.round(d.value * 10 ** precision) / 10 ** precision
      )

  return (
    <div className="mt-1 h-full w-full">
      <ResponsiveContainer width="99%" height="99%">
        <BarChart
          data={histogramData}
          margin={{
            bottom: 30,
            left: 10,
            right: 30,
            top: histogramKeys.length > 1 ? 0 : 20,
          }}
        >
          <XAxis
            dataKey="value"
            type="number"
            domain={[criterionMin, criterionMax]}
            label={{
              value: criterionName,
              position: 'bottom',
            }}
            ticks={tickValues}
            tick={(props) => {
              const { x, y, payload } = props

              if (!hasLabels)
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={16}
                      textAnchor="middle"
                      className={textSize.textLg}
                    >
                      {payload.value}
                    </text>
                  </g>
                )

              if (Math.abs(payload.value - criterionMin) < 0.1) {
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={16}
                      textAnchor="start"
                      className={textSize.textLg}
                    >
                      {criterionLabels?.min}
                    </text>
                  </g>
                )
              } else if (Math.abs(payload.value - criterionMax) < 0.1) {
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={16}
                      textAnchor="end"
                      className={textSize.textLg}
                    >
                      {criterionLabels?.max}
                    </text>
                  </g>
                )
              } else if (
                Math.abs(payload.value - (criterionMin + criterionMax) / 2) <
                  0.1 &&
                criterionLabels?.mid
              ) {
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={16}
                      textAnchor="middle"
                      className={textSize.textLg}
                    >
                      {criterionLabels?.mid}
                    </text>
                  </g>
                )
              }

              return <></>
            }}
            className={textSize.textXl}
          />
          <YAxis
            domain={[
              0,
              (dataMax: number): number => {
                const rounded = Math.ceil(dataMax * 1.1)
                if (rounded % 2 === 0) {
                  return rounded
                }
                return rounded + 1
              },
            ]}
            label={{
              value: t('manage.evaluation.count'),
              angle: -90,
              position: 'left',
              offset: -10,
              style: { textAnchor: 'middle' },
            }}
            className={textSize.textXl}
          />
          <CartesianGrid strokeDasharray="5 5" />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload

                return (
                  <div className="border-uzh-grey-100 rounded-md border border-solid bg-white p-2">
                    <div>
                      {data.exactBinMatch && !hasLabels
                        ? t('manage.evaluation.value')
                        : t('manage.evaluation.histogramRange')}
                      :{' '}
                      {hasLabels
                        ? getLabelForValue(
                            data.label,
                            {
                              id: '',
                              name: criterionName,
                              labels: criterionLabels,
                            },
                            criterionMin,
                            criterionMax,
                            true
                          )
                        : data.label}
                    </div>
                    {typeof data.count !== 'undefined' && (
                      <div className="text-primary-100 font-bold">
                        {t('manage.evaluation.count')}: {data.count}
                      </div>
                    )}
                    {typeof data.count === 'undefined' &&
                      histogramKeys.map((dataKey) => {
                        const itemName = dataKey.split('-')[0]
                        return (
                          <div
                            key={`histogram-key-${dataKey}`}
                            className="text-primary-100 font-bold"
                          >
                            {itemName}: {data[dataKey]}
                          </div>
                        )
                      })}
                  </div>
                )
              }
              return null
            }}
          />

          {histogramKeys.map((dataKey) => {
            const ix = parseInt(dataKey.split('-')[1])
            return (
              <Bar
                key={`bar-histogram-key-${dataKey}`}
                dataKey={dataKey}
                fill={CHART_COLORS[ix % 12] ?? '#1395BA'}
              />
            )
          })}

          {solutionData &&
            histogramKeys.map((dataKey) => {
              const solutionRange = solutionData[dataKey]
              if (!solutionRange) return null

              const ix = parseInt(dataKey.split('-')[1])
              const areaColor =
                histogramKeys.length === 1
                  ? CHART_SOLUTION_COLORS.correct
                  : CHART_COLORS[ix % 12]

              return (
                <ReferenceArea
                  key={`solution-reference-area-${dataKey}`}
                  x1={solutionRange.min ?? undefined}
                  x2={solutionRange.max ?? undefined}
                  stroke={areaColor}
                  fill={areaColor}
                  enableBackground="#FFFFFF"
                  opacity={0.4}
                  label={{
                    fill: CHART_SOLUTION_COLORS.correct,
                    position: 'top',
                    value: t('manage.evaluation.correctLabel'),
                  }}
                  className={textSize.text}
                />
              )
            })}
          {histogramKeys.length > 1 && (
            <Legend
              align="right"
              verticalAlign="top"
              wrapperStyle={{
                fontSize: '1.125rem',
                lineHeight: '1.75rem',
              }}
              formatter={(value) => {
                if (value === 'count') {
                  return null
                }

                // remove trailing index
                return value.split('-')[0]
              }}
              className={textSize.textLg}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CSEvaluationHistogramChart
