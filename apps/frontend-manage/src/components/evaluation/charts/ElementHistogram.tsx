import {
  ElementType,
  NumericalElementInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_SOLUTION_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { NumberField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
import { twMerge } from 'tailwind-merge'
import useEvaluationHistogramData from '../hooks/useEvaluationHistogramData'

interface ElementHistogramProps {
  instance: NumericalElementInstanceEvaluation
  showSolution: {
    general: boolean
    mean?: boolean
    median?: boolean
    q1?: boolean
    q3?: boolean
    sd?: boolean
  }
  textSize: string
  className?: string
}

function ElementHistogram({
  instance,
  showSolution,
  textSize,
  className,
}: ElementHistogramProps) {
  const t = useTranslations()
  const supportedElementTypes = [ElementType.Numerical]
  const [numBins, setNumBins] = useState('20')

  const processedData = useEvaluationHistogramData({
    instance,
    binCount: parseInt(numBins),
  })

  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return (
    <div className={twMerge('mt-1 h-[calc(100%-4rem)]', className)}>
      <ResponsiveContainer width="99%" height="99%">
        <BarChart
          data={processedData.data}
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
            domain={[processedData.domain.min, processedData.domain.max]}
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
                    <div className="text-primary-100 font-bold">
                      {t('manage.evaluation.count')}:{' '}
                      {payload[0]!.payload.count}
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="count" fill="rgb(19, 149, 186)" />

          {/* // TODO: reintroduce these elements as soon as statistics are available for asynchronous elements */}
          {/* {data.statistics && showSolution.mean && (
            <ReferenceLine
              isFront
              label={{
                fill: 'blue',
                position: 'top',
                value: 'MEAN',
              }}
              className={textSize}
              key={`mean-` + data.statistics.mean}
              stroke="blue"
              x={data.statistics.mean}
            />
          )}
          {data.statistics && showSolution.median && (
            <ReferenceLine
              isFront
              label={{
                fill: 'red',
                position: 'top',
                value: 'MEDIAN',
              }}
              className={textSize}
              key={`median-` + data.statistics.median}
              stroke="red"
              x={data.statistics.median}
            />
          )}
          {data.statistics && showSolution.q1 && (
            <ReferenceLine
              isFront
              label={{
                fill: 'black',
                position: 'top',
                value: 'Q1',
              }}
              className={textSize}
              key={`q1-` + data.statistics.q1}
              stroke="black"
              x={data.statistics.q1}
            />
          )}
          {data.statistics && showSolution.q3 && (
            <ReferenceLine
              isFront
              label={{
                fill: 'black',
                position: 'top',
                value: 'Q3',
              }}
              className={textSize}
              key={`q3-` + data.statistics.q3}
              stroke="black"
              x={data.statistics.q3}
            />
          )}
          {data.statistics && showSolution.sd && (
            <ReferenceArea
              key="sd-area"
              x1={Math.max(
                data.statistics.mean - data.statistics.sd,
                processedData.domain.min
              )}
              x2={Math.min(
                data.statistics.mean + data.statistics.sd,
                processedData.domain.max
              )}
              fill="gray"
              enableBackground="#FFFFFF"
              label={{
                fill: 'red',
                position: 'insideTopRight',
                value: '+- 1 SD',
              }}
              className={textSize}
            />
          )} */}

          {showSolution.general &&
            instance.results.solutionRanges &&
            instance.results.solutionRanges.map(
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
                  label={{
                    fill: CHART_SOLUTION_COLORS.correct,
                    position: 'top',
                    value: 'Korrekt',
                  }}
                  className={textSize}
                />
              )
            )}
        </BarChart>
      </ResponsiveContainer>

      <div className="float-right mr-4 flex flex-row items-center gap-2">
        <NumberField
          precision={0}
          id="histogramBins"
          label={t('manage.evaluation.histogramBins')}
          value={numBins}
          onChange={(value) => setNumBins(value)}
        />
      </div>
    </div>
  )
}

export default ElementHistogram
