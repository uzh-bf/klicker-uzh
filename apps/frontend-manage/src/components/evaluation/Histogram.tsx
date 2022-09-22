import { histogram, thresholdFreedmanDiaconis } from 'd3'
import { maxBy, minBy, round, sumBy } from 'lodash'
import React, { useMemo, useState } from 'react'
// TODO: replace lodash with ramda
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface HistogramProps {
  brush?: boolean
  data: {
    correct: boolean
    votes: number
    value: string | number
  }[]
  solution?: number
  statistics?: any
  min?: number
  max?: number
}

const defaultValues = {
  brush: false,
  solution: undefined,
  statistics: undefined,
}

function Histogram({
  brush,
  data,
  solution,
  statistics,
  min,
  max,
}: HistogramProps): React.ReactElement {
  const [numBins, setNumBins] = useState(20)

  const processedData = useMemo(() => {
    const mappedData = data.map((item) => ({
      value: +item.value,
      votes: +item.votes,
    }))

    // calculate the borders of the histogram
    const computedMin = min ?? minBy(mappedData, (o): number => o.value)?.value
    const computedMax = max ?? maxBy(mappedData, (o): number => o.value)?.value

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
      votes: sumBy(bin, 'votes'),
      value: `${round(round(bin.x0, 2) / round(bin.x1, 2), 1)}`,
      label: `${bin.x0}/${bin.x1}`,
    }))
  }, [data, numBins])

  return (
    <div>
      <ResponsiveContainer minWidth={800} height={400}>
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
          <Bar dataKey="votes" fill="rgb(19, 149, 186)" />

          {/* // TODO: reintroduce statistics when ready
      {statistics && [
        <ReferenceLine
          isFront
          label={{
            fill: 'blue',
            fontSize: '1rem',
            position: 'top',
            value: 'MEAN',
          }}
          key={statistics.mean}
          stroke="blue"
          x={Math.round(statistics.mean)}
        />,
        <ReferenceLine
          isFront
          label={{
            fill: 'red',
            fontSize: '1rem',
            position: 'top',
            value: 'MEDIAN',
          }}
          key={statistics.median}
          stroke="red"
          x={Math.round(statistics.median)}
        />,
        <ReferenceLine
          isFront
          label={{
            fill: 'black',
            fontSize: '1rem',
            position: 'top',
            value: 'Q1',
          }}
          key={statistics.q1}
          stroke="black"
          x={Math.round(statistics.q1)}
        />,
        <ReferenceLine
          isFront
          label={{
            fill: 'black',
            fontSize: '1rem',
            position: 'top',
            value: 'Q3',
          }}
          key={statistics.q3}
          stroke="black"
          x={Math.round(statistics.q3)}
        />,
      ]}

      { // TODO: illustrate solution when ready
        solution && (
        <ReferenceLine isFront stroke="green" x={Math.round(solution)} />
      )}

      { // TODO
        brush && <Brush dataKey="value" height={30} stroke="#8884d8" />} */}
        </BarChart>
      </ResponsiveContainer>

      <div>
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
