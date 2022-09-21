import { histogram, thresholdFreedmanDiaconis } from 'd3'
import React from 'react'

// TODO: replace lodash with ramda
import _maxBy from 'lodash/maxBy'
import _minBy from 'lodash/minBy'
import _round from 'lodash/round'
import _sumBy from 'lodash/sumBy'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'

interface HistogramProps {
  brush?: boolean
  data: {
    correct: boolean
    votes: number
    value: string | number
  }[]
  solution?: number
  statistics?: any
  numBins: number
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
  numBins,
}: HistogramProps): React.ReactElement {
  // calculate the borders of the histogram
  const min = +_minBy(data, (o): number => +o.value).value
  const max = +_maxBy(data, (o): number => +o.value).value

  // calculate the number of bins according to freedman diaconis
  const defaultThreshold = thresholdFreedmanDiaconis(
    data.map((o): number => +o.value),
    min,
    max
  )

  // setup the D3 histogram generator
  // use either the passed number of bins or the default threshold
  const histGen = histogram()
    .domain([min, max])
    .value((o): number => _round(+o.value, 2))
    .thresholds(numBins || defaultThreshold)

  // bin the data using D3
  const bins = histGen(data)

  // map the bins to recharts objects
  const mappedData = bins.map((bin): any => ({
    votes: _sumBy(bin, 'votes'),
    value: `${_round(_round(bin.x0, 2) / _round(bin.x1, 2), 1)}`,
  }))

  return (
    <BarChart
      data={mappedData}
      margin={{
        bottom: 16,
        left: -24,
        right: 24,
        top: 24,
      }}
      width={800}
      height={400}
    >
      <XAxis dataKey="value" />
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
  )
}

export default Histogram
