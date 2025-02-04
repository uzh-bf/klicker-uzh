import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function CSEvaluationHistogramChart({
  histogramData,
  solutionData,
  histogramKeys,
  criterionMin,
  criterionMax,
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
}) {
  const t = useTranslations()

  return (
    <div className="mt-1 h-[calc(100%-4rem)] w-full">
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
                    {payload[0]!.payload.count && (
                      <div className="text-primary-100 font-bold">
                        {t('manage.evaluation.count')}:{' '}
                        {payload[0]!.payload.count}
                      </div>
                    )}
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

          {/* // TODO: if enabled, show solution ranges for different criteria / items here */}
          {/* {showSolutionRanges &&
            solutionRanges.map(
              (
                solutionRange: { min?: number | null; max?: number | null },
                index: number
              ) => (
                <ReferenceArea
                  key={index}
                  x1={solutionRange.min ?? undefined}
                  x2={solutionRange.max ?? undefined}
                  stroke={CHART_SOLUTION_COLORS.correct}
                  fill={CHART_SOLUTION_COLORS.correct}
                  enableBackground="#FFFFFF"
                  opacity={1}
                  label={
                    !basic
                      ? {
                          fill: CHART_SOLUTION_COLORS.correct,
                          position: 'top',
                          value: t('manage.evaluation.correctLabel'),
                        }
                      : undefined
                  }
                  className={textSize}
                />
              )
            )} */}
        </BarChart>
      </ResponsiveContainer>
      {/* {hideBins ? null : (
        <div className="float-right mr-4 flex flex-row items-center gap-2">
          <NumberField
            precision={0}
            id="histogramBins"
            label={t('manage.evaluation.histogramBins')}
            value={numBins}
            onChange={(value) => setNumBins(value)}
          />
        </div>
      )} */}
    </div>
  )
}

export default CSEvaluationHistogramChart
