import {
  CHART_COLORS,
  CHART_SOLUTION_COLORS,
} from '@klicker-uzh/shared-components/src/constants'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TextSizeType } from '../textSizes'

function CSEvaluationHistogramChart({
  histogramData,
  solutionData,
  histogramKeys,
  criterionMin,
  criterionMax,
  textSize,
}: {
  histogramData: {
    value: number
    label: string
    [dataIx: string]: number | string
  }[]
  solutionData?: {
    [dataIx: string]: { min: number; max: number } | undefined
  }
  histogramKeys: string[]
  criterionMin: number
  criterionMax: number
  textSize: TextSizeType
}) {
  const t = useTranslations()

  return (
    <div className="mt-1 h-full w-full">
      <ResponsiveContainer width="99%" height="99%">
        <BarChart
          data={histogramData}
          margin={{
            bottom: 16,
            left: -24,
            right: 24,
            top: 24,
          }}
        >
          <XAxis
            dataKey="value"
            type="number"
            domain={[criterionMin, criterionMax]}
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
          />
          <CartesianGrid strokeDasharray="5 5" />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                return (
                  <div className="border-uzh-grey-100 rounded-md border border-solid bg-white p-2">
                    <div>
                      {t('manage.evaluation.histogramRange')}:{' '}
                      {payload[0]!.payload.label}
                    </div>
                    {typeof payload[0]!.payload.count !== 'undefined' && (
                      <div className="text-primary-100 font-bold">
                        {t('manage.evaluation.count')}:{' '}
                        {payload[0]!.payload.count}
                      </div>
                    )}
                    {typeof payload[0]!.payload.count === 'undefined' &&
                      histogramKeys.map((dataKey) => {
                        const itemName = dataKey.split('-')[0]
                        return (
                          <div
                            key={`histogram-key-${dataKey}`}
                            className="text-primary-100 font-bold"
                          >
                            {itemName}: {payload[0]!.payload[dataKey]}
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
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CSEvaluationHistogramChart
