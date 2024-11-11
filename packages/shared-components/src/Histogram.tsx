import type { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { NumberField } from '@uzh-bf/design-system'
import { maxBy, minBy, round, sumBy } from 'lodash'
import { useTranslations } from 'next-intl'
import React, { useMemo, useState } from 'react'
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
import { CHART_SOLUTION_COLORS } from './constants'

interface HistogramProps {
  data: Partial<InstanceResult>
  showSolution: {
    general: boolean
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
  className?: {
    root?: string
  }
}

function Histogram({
  data,
  showSolution = {
    general: false,
    mean: false,
    median: false,
    q1: false,
    q3: false,
    sd: false,
  },
  textSize,
  hideBins = false,
  basic = false,
  reference,
  className,
}: HistogramProps): React.ReactElement {
  const t = useTranslations()
  const [numBins, setNumBins] = useState('20')

  const binCount = useMemo(() => {
    const binCount = parseInt(numBins)

    if (isNaN(binCount)) {
      return 20
    }

    return binCount
  }, [numBins])

  if (data.questionData?.__typename !== 'NumericalQuestionData') {
    return <div>{t('manage.evaluation.histogramNotSupported')}</div>
  }

  const questionData = data.questionData
  const processedData = useMemo(() => {
    const mappedData = Object.values(
      data.results as Record<string, { count: number; value: string }>
    ).map((result) => ({
      value: +result.value,
      count: result.count,
    }))

    const min: number =
      questionData.options.restrictions &&
      typeof questionData.options.restrictions['min'] === 'number'
        ? questionData.options.restrictions['min']
        : (minBy(mappedData, 'value')?.value ?? 0) - 10
    const max: number =
      questionData.options.restrictions &&
      typeof questionData.options.restrictions['max'] === 'number'
        ? questionData.options.restrictions['max']
        : (maxBy(mappedData, 'value')?.value ?? 0) + 10

    let dataArray = Array.from({ length: binCount }, (_, i) => ({
      value: min + (max - min) * (i / binCount) + (max - min) / (2 * binCount),
    }))

    dataArray = dataArray.map((bin) => {
      const binWidth =
        dataArray.length > 1 ? dataArray[1]!.value - dataArray[0]!.value : 1
      const count = sumBy(
        mappedData.filter((result) => {
          return (
            result.value >= bin.value - binWidth / 2 &&
            (bin.value + binWidth / 2 === max
              ? result.value <= max
              : result.value < bin.value + binWidth / 2)
          )
        }),
        'count'
      )
      return {
        value: round(bin.value, 2),
        count,
        label: `${round(bin.value - binWidth / 2, 1)} - ${round(
          bin.value + binWidth / 2,
          1
        )}`,
      }
    })

    return { data: dataArray, domain: { min: min, max: max } }
  }, [data.results, binCount, questionData.options.restrictions])

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
          {data.statistics && showSolution.mean && (
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
          )}

          {showSolution.general &&
            questionData.options.solutionRanges &&
            !questionData.options.solutionRanges.every(
              (range) =>
                typeof range.min !== 'undefined' &&
                range.min !== null &&
                typeof range.max !== 'undefined' &&
                range.max !== null &&
                range.min > range.max - 2 * Number.EPSILON
            ) &&
            questionData.options.solutionRanges.map(
              (
                solutionRange: { min?: number | null; max?: number | null },
                index: number
              ) => (
                <ReferenceArea
                  key={index}
                  x={solutionRange.min ?? undefined}
                  stroke={CHART_SOLUTION_COLORS.correct}
                  label={
                    !basic && {
                      fill: CHART_SOLUTION_COLORS.correct,
                      position: 'top',
                      value: 'Korrekt',
                    }
                  }
                  className={textSize}
                />
              )
            )}

          {/* // TODO: when migrating to exact solutions support on numerical questions, replace this */}
          {showSolution.general &&
            questionData.options.solutionRanges &&
            questionData.options.solutionRanges.every(
              (range) =>
                typeof range.min !== 'undefined' &&
                range.min !== null &&
                typeof range.max !== 'undefined' &&
                range.max !== null &&
                range.min > range.max - 2 * Number.EPSILON
            ) &&
            questionData.options.solutionRanges.map(
              (
                solutionRange: { min?: number | null; max?: number | null },
                index: number
              ) => (
                <ReferenceLine
                  key={index}
                  x={solutionRange.min ?? undefined}
                  stroke={CHART_SOLUTION_COLORS.correct}
                  fill={CHART_SOLUTION_COLORS.correct}
                  enableBackground="#FFFFFF"
                  opacity={basic ? 0.6 : 1}
                  label={
                    !basic && {
                      fill: CHART_SOLUTION_COLORS.correct,
                      position: 'top',
                      value: 'Korrekt',
                    }
                  }
                  className={textSize}
                />
              )
            )}
        </BarChart>
      </ResponsiveContainer>

      {!hideBins && (
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

export default Histogram
