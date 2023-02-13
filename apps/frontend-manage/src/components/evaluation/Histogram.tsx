import {
  InstanceResult,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'
import { ThemeContext } from '@uzh-bf/design-system'
import { maxBy, minBy, round, sumBy } from 'lodash'
import React, { useContext, useMemo, useState } from 'react'
// TODO: replace lodash with ramda
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

interface HistogramProps {
  data: InstanceResult
  showSolution: {
    general: boolean
    mean?: boolean
    median?: boolean
    q1?: boolean
    q3?: boolean
    sd?: boolean
  }
  textSize: string
}

const defaultProps = {
  showSolution: {
    general: false,
    mean: false,
    median: false,
    q1: false,
    q3: false,
    sd: false,
  },
}

function Histogram({
  data,
  showSolution,
  textSize,
}: HistogramProps): React.ReactElement {
  const theme = useContext(ThemeContext)
  const [numBins, setNumBins] = useState(20)

  const questionData = data.questionData as NumericalQuestionData

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
        : (minBy(mappedData, 'value')?.value || 0) - 10
    const max: number =
      questionData.options.restrictions &&
      typeof questionData.options.restrictions['max'] === 'number'
        ? questionData.options.restrictions['max']
        : (maxBy(mappedData, 'value')?.value || 0) + 10

    let dataArray = Array.from({ length: numBins }, (_, i) => ({
      value: min + (max - min) * (i / numBins) + (max - min) / (2 * numBins),
    }))

    dataArray = dataArray.map((bin) => {
      const binWidth =
        dataArray.length > 1 ? dataArray[1].value - dataArray[0].value : 1
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
  }, [data, numBins])

  return (
    <div className="h-[calc(100%-4rem)] mt-1">
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
              if (active && payload && payload.length) {
                return (
                  <div className="p-2 bg-white border border-solid rounded-md border-uzh-grey-100">
                    <div>Bereich: {payload[0].payload.label}</div>
                    <div className={twMerge('font-bold', theme.primaryText)}>
                      Count: {payload[0].payload.count}
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="count" fill="rgb(19, 149, 186)" />
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
              x={Math.round(data.statistics.mean || 0)}
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
              x={Math.round(data.statistics.median || 0)}
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
              x={Math.round(data.statistics.q1 || 0)}
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
              x={Math.round(data.statistics.q3 || 0)}
            />
          )}
          {data.statistics && showSolution.sd && (
            <ReferenceArea
              key="sd-area"
              x1={Math.max(
                (data.statistics.mean || 0) - (data.statistics.sd ?? 0),
                processedData.domain.min
              )}
              x2={Math.min(
                (data.statistics.mean || 0) + (data.statistics.sd ?? 0),
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
            questionData.options.solutionRanges.map(
              (
                solutionRange: { min?: number | null; max?: number | null },
                index: number
              ) => (
                <ReferenceArea
                  key={index}
                  x1={solutionRange.min ?? undefined}
                  x2={solutionRange.max ?? undefined}
                  stroke="green"
                  fill="green"
                  enableBackground="#FFFFFF"
                  label={{
                    fill: 'green',
                    position: 'top',
                    value: 'Korrekt',
                  }}
                  className={textSize}
                />
              )
            )}
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-row items-center float-right gap-2 mr-4">
        <div className="font-bold">Bins:</div>
        <input
          className="rounded-md"
          type="number"
          value={numBins}
          onChange={(e) => setNumBins(+e.target.value)}
        />
      </div>
    </div>
  )
}

Histogram.defaultProps = defaultProps
export default Histogram
