import { ElementType, type Statistics } from '@klicker-uzh/graphql/dist/ops'
import { CHART_SOLUTION_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { NumberField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { twMerge } from 'tailwind-merge'
import useEvaluationHistogramData from '../hooks/useEvaluationHistogramData'

interface ElementHistogramProps {
  type: ElementType
  responses: { value: number; count: number }[]
  solutionRanges?: { min?: number | null; max?: number | null }[]
  exactSolutions?: (number | string)[] | null
  statistics?: Statistics | null
  minValue?: number | null
  maxValue?: number | null
  showSolution: boolean
  showStatistics?: {
    mean?: boolean
    median?: boolean
    q1?: boolean
    q3?: boolean
    sd?: boolean
  }
  textSize: string
  reference?: number
  hideBins?: boolean
  basic?: boolean
  className?: { root?: string }
}

function ElementHistogram({
  type,
  responses,
  solutionRanges,
  exactSolutions,
  statistics,
  minValue,
  maxValue,
  showSolution,
  showStatistics,
  textSize,
  reference,
  hideBins = false,
  basic = false,
  className,
}: ElementHistogramProps) {
  const t = useTranslations()
  const supportedElementTypes = [ElementType.Numerical]
  const [numBins, setNumBins] = useState('20')

  const showSolutionRanges = showSolution && solutionRanges
  const showExactSolutions =
    showSolution && exactSolutions && exactSolutions.length > 0
  const processedData = useEvaluationHistogramData({
    type,
    responses,
    solutionRanges: showSolutionRanges ? solutionRanges : undefined,
    exactSolutions: showExactSolutions
      ? exactSolutions.map((solution) =>
          typeof solution === 'number' ? solution : parseFloat(solution)
        )
      : undefined,
    minValue,
    maxValue,
    binCount: parseInt(numBins),
  })

  if (!supportedElementTypes.includes(type) || !processedData) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return (
    <div className={twMerge('mt-1 h-[calc(100%-4rem)]', className?.root)}>
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
          {reference && (
            <ReferenceLine
              isFront
              className={textSize}
              key="reference"
              stroke="red"
              x={reference}
            />
          )}

          {statistics && showStatistics?.mean && (
            <ReferenceLine
              isFront
              label={{
                fill: 'blue',
                position: 'top',
                value: 'MEAN',
              }}
              className={textSize}
              key={`mean-` + statistics.mean}
              stroke="blue"
              x={statistics.mean}
            />
          )}
          {statistics && showStatistics?.median && (
            <ReferenceLine
              isFront
              label={{
                fill: 'red',
                position: 'top',
                value: 'MEDIAN',
              }}
              className={textSize}
              key={`median-` + statistics.median}
              stroke="red"
              x={statistics.median}
            />
          )}
          {statistics && showStatistics?.q1 && (
            <ReferenceLine
              isFront
              label={{
                fill: 'black',
                position: 'top',
                value: 'Q1',
              }}
              className={textSize}
              key={`q1-` + statistics.q1}
              stroke="black"
              x={statistics.q1}
            />
          )}
          {statistics && showStatistics?.q3 && (
            <ReferenceLine
              isFront
              label={{
                fill: 'black',
                position: 'top',
                value: 'Q3',
              }}
              className={textSize}
              key={`q3-` + statistics.q3}
              stroke="black"
              x={statistics.q3}
            />
          )}
          {statistics && showStatistics?.sd && (
            <ReferenceArea
              key="sd-area"
              x1={Math.max(
                statistics.mean - statistics.sd,
                processedData.domain.min
              )}
              x2={Math.min(
                statistics.mean + statistics.sd,
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
          )}

          {showSolutionRanges &&
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
            )}

          {showExactSolutions &&
            exactSolutions.map((solution, idx) => (
              <ReferenceLine
                key={`exact-solution-${idx}`}
                isFront
                x={parseFloat(String(solution))}
                stroke={CHART_SOLUTION_COLORS.correct}
                label={{
                  fill: CHART_SOLUTION_COLORS.correct,
                  position: 'top',
                  value: t('manage.evaluation.correctLabelValue', {
                    value: solution,
                  }),
                }}
                className={textSize}
              />
            ))}
        </BarChart>
      </ResponsiveContainer>

      {hideBins ? null : (
        <div className="float-right mr-4 flex flex-row items-center gap-2">
          <NumberField
            precision={0}
            id="histogramBins"
            label={t('manage.evaluation.histogramBins')}
            value={numBins}
            onChange={(value) => setNumBins(value)}
          />
        </div>
      )}
    </div>
  )
}

export default ElementHistogram
