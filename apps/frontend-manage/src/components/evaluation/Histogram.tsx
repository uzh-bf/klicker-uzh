import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { maxBy, minBy, round, sumBy } from 'lodash'
import React, { useMemo, useState } from 'react'
// TODO: replace lodash with ramda
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface HistogramProps {
  data: InstanceResult
  showSolution: boolean
  brush?: boolean // TODO: Not implemented yet
}

function Histogram({
  brush,
  data,
  showSolution,
}: HistogramProps): React.ReactElement {
  const [numBins, setNumBins] = useState(20)

  const processedData = useMemo(() => {
    const mappedData = Object.values(data.results).map((result) => ({
      value: result.value,
      count: result.count,
    }))

    // create array with numbin entries and fill it evenly with values between data.questionData.options.solutionRanges.min and data.questionData.options.solutionRanges.max if they are defined and min of mappedData - 10 and max of mappedData + 10 if not
    const min = data.questionData.options.restrictions['min']
      ? data.questionData.options.restrictions.min
      : minBy(mappedData, 'value')?.value - 10
    const max = data.questionData.options.restrictions['max']
      ? data.questionData.options.restrictions.max
      : maxBy(mappedData, 'value')?.value + 10

    let dataArray = Array.from({ length: numBins }, (_, i) => {
      return {
        value: min + (max - min) * (i / numBins) + (max - min) / (2 * numBins),
      }
    })

    // prepare the dataArray by adding a count of elements and label to each bin
    dataArray = dataArray.map((bin) => {
      const binWidth =
        dataArray.length > 1 ? dataArray[1].value - dataArray[0].value : 1
      const count = sumBy(
        mappedData.filter((result) => {
          return (
            result.value >= bin.value - binWidth / 2 &&
            result.value < bin.value + binWidth / 2
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

    return dataArray
  }, [data, numBins])

  return (
    <div>
      <ResponsiveContainer width="99%" height={500}>
        <BarChart
          data={processedData}
          margin={{
            bottom: 16,
            left: -24,
            right: 24,
            top: 24,
          }}
        >
          <XAxis dataKey="value" type="number" />
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
                    <div className="font-bold text-uzh-blue-80">
                      Count: {payload[0].payload.count}
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="count" fill="rgb(19, 149, 186)" />

          {data.statistics && [
            <ReferenceLine
              isFront
              label={{
                fill: 'blue',
                fontSize: '1rem',
                position: 'top',
                value: 'MEAN',
              }}
              key={data.statistics.mean}
              stroke="blue"
              x={Math.round(data.statistics.mean || 0)}
            />,
            <ReferenceLine
              isFront
              label={{
                fill: 'red',
                fontSize: '1rem',
                position: 'top',
                value: 'MEDIAN',
              }}
              key={data.statistics.median}
              stroke="red"
              x={Math.round(data.statistics.median || 0)}
            />,
            <ReferenceLine
              isFront
              label={{
                fill: 'black',
                fontSize: '1rem',
                position: 'top',
                value: 'Q1',
              }}
              key={data.statistics.q1}
              stroke="black"
              x={Math.round(data.statistics.q1 || 0)}
            />,
            <ReferenceLine
              isFront
              label={{
                fill: 'black',
                fontSize: '1rem',
                position: 'top',
                value: 'Q3',
              }}
              key={data.statistics.q3}
              stroke="black"
              x={Math.round(data.statistics.q3 || 0)}
            />,
          ]}
          {showSolution &&
            data.questionData.options.solutionRanges.map(
              (
                solutionRange: { min?: number; max?: number },
                index: number
              ) => (
                <ReferenceArea
                  key={index}
                  x1={solutionRange.min}
                  x2={solutionRange.max}
                  stroke="green"
                  fill="green"
                  enableBackground="#FFFFFF"
                  label={{
                    fill: 'green',
                    fontSize: '1rem',
                    position: 'top',
                    value: 'Korrekt',
                  }}
                />
              )
            )}

          {/* // TODO: fix brush */}
          {/* {brush && (
            <Brush dataKey="value" type="number" height={30} stroke="#8884d8" />
          )} */}
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

export default Histogram
