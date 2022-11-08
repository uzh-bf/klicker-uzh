import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import { histogram, thresholdFreedmanDiaconis } from 'd3'
import { maxBy, minBy, round, sumBy } from 'lodash'
import React, { useMemo, useState } from 'react'
// TODO: replace lodash with ramda
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface HistogramProps {
  brush?: boolean // TODO: Not implemented yet
  data: InstanceResult
  showSolution: boolean // TODO: Not implemented yet
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

    // calculate the borders of the histogram
    const computedMin =
      data.questionData.options?.restrictions?.min ??
      minBy(mappedData, (o): number => o.value)?.value
    const computedMax =
      data.questionData.options?.restrictions?.max ??
      maxBy(mappedData, (o): number => o.value)?.value

    // calculate the number of bins according to freedman diaconis
    const defaultThreshold = thresholdFreedmanDiaconis(
      mappedData.map((o): number => +o.value),
      computedMin,
      computedMax
    )

    // setup the D3 histogram generator
    // use either the passed number of bins or the default threshold
    const histGen = histogram()
      .domain([computedMin, computedMax])
      .value((o): number => round(o.value, 2))
      .thresholds(numBins || defaultThreshold)

    // bin the data using D3
    const bins = histGen(mappedData)

    // map the bins to recharts objects
    return bins.map((bin): any => ({
      count: sumBy(bin, 'count'),
      value: `${round(round(bin.x0, 2) / round(bin.x1, 2), 1)}`,
      label: `${bin.x0}/${bin.x1}`,
    }))
  }, [data, numBins])

  return (
    <div>
      <ResponsiveContainer minWidth={800} height={400} className="z-10">
        <BarChart
          data={processedData}
          margin={{
            bottom: 16,
            left: -24,
            right: 24,
            top: 24,
          }}
        >
          <XAxis dataKey="label" />
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
          <Tooltip />
          <Bar dataKey="count" fill="rgb(19, 149, 186)" />
          {/* // TODO: For some reason, this does not work */}
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
              x={Math.round(data.statistics.mean)}
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
              x={Math.round(data.statistics.median)}
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
              x={Math.round(data.statistics.q1)}
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
              x={Math.round(data.statistics.q3)}
            />,
          ]}
          {/* 
      { // TODO: illustrate solution ranges when ready
        showSolution && (
        <ReferenceLine isFront stroke="green" x={Math.round(solution)} />
      )}

      { // TODO
        brush && <Brush dataKey="value" height={30} stroke="#8884d8" />} */}
        </BarChart>
      </ResponsiveContainer>

      <div className="float-right mr-4">
        Bins:{' '}
        <input
          type="number"
          value={numBins}
          onChange={(e) => setNumBins(+e.target.value)}
        />
      </div>
    </div>
  )
}

export default Histogram
