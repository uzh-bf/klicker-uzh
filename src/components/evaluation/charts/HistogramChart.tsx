/* eslint-disable no-mixed-operators,no-plusplus,no-loop-func */
import React from 'react'
import _minBy from 'lodash/minBy'
import _maxBy from 'lodash/maxBy'
import _sumBy from 'lodash/sumBy'
import _round from 'lodash/round'
import { histogram, thresholdFreedmanDiaconis } from 'd3'
import {
  Bar,
  BarChart,
  Brush,
  ReferenceLine,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Props {
  brush?: boolean
  data: {
    correct?: boolean
    count: number
    value: string
  }[]
  solution?: number
  statistics: any
  numBins?: number
}

const defaultProps = {
  brush: false,
  data: [],
  solution: undefined,
  statistics: undefined,
}

function HistogramChart({ brush, data, solution, statistics, numBins }: Props): React.ReactElement {
  // calculate the borders of the histogram
  const min = +_minBy(data, o => +o.value).value
  const max = +_maxBy(data, o => +o.value).value

  // calculate the number of bins according to freedman diaconis
  const defaultThreshold = thresholdFreedmanDiaconis(data.map(o => +o.value), min, max)

  // setup the D3 histogram generator
  // use either the passed number of bins or the default threshold
  const histGen = histogram()
    .domain([min, max])
    .value(o => _round(+o.value, 2))
    .thresholds(numBins || defaultThreshold)

  // bin the data using D3
  const bins = histGen(data)

  // map the bins to recharts objects
  const mappedData = bins.map(bin => ({
    count: _sumBy(bin, 'count'),
    value: `${_round(bin.x0, 2)}/${_round(bin.x1, 2)}`,
  }))

  return (
    <ResponsiveContainer>
      <BarChart
        data={mappedData}
        margin={{
          bottom: 16,
          left: -24,
          right: 24,
          top: 24,
        }}
      >
        <XAxis dataKey="value" />
        <YAxis
          domain={[
            0,
            dataMax => {
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

        {statistics && [
          <ReferenceLine
            isFront
            label={{
              fill: 'blue',
              fontSize: '1rem',
              position: 'top',
              value: 'MEAN',
            }}
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
            stroke="black"
            x={Math.round(statistics.q3)}
          />,
        ]}

        {solution && <ReferenceLine isFront stroke="green" x={Math.round(solution)} />}

        {brush && <Brush dataKey="value" height={30} stroke="#8884d8" />}
      </BarChart>
    </ResponsiveContainer>
  )
}

HistogramChart.defaultProps = defaultProps

export default HistogramChart
