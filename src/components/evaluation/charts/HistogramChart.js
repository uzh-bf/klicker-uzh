/* eslint-disable no-mixed-operators,no-plusplus,no-loop-func */
import React from 'react'
import PropTypes from 'prop-types'
import _range from 'lodash/range'
import { compose, withProps } from 'recompose'
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

import { statisticsShape } from '../../../propTypes'

const propTypes = {
  brush: PropTypes.bool,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  solution: PropTypes.number,
  statistics: statisticsShape,
}

const defaultProps = {
  brush: false,
  data: [],
  solution: undefined,
  statistics: undefined,
}

const HistogramChart = ({
  brush, data, solution, statistics,
}) => (
  <ResponsiveContainer>
    <BarChart
      data={data}
      margin={{
        bottom: 16,
        left: -24,
        right: 24,
        top: 24,
      }}
    >
      <XAxis dataKey="value" />
      <YAxis />
      <CartesianGrid strokeDasharray="5 5" />
      <Tooltip />
      <Bar dataKey="count" fill="#8884d8" />

      {statistics && [
        <ReferenceLine isFront stroke="blue" x={Math.round(statistics.mean)} />,
        <ReferenceLine isFront stroke="red" x={Math.round(statistics.median)} />,
      ]}

      {solution && <ReferenceLine isFront stroke="green" x={Math.round(solution)} />}

      {brush && <Brush dataKey="value" height={30} stroke="#8884d8" />}
    </BarChart>
  </ResponsiveContainer>
)

HistogramChart.propTypes = propTypes
HistogramChart.defaultProps = defaultProps

export default compose(
  withProps(({ data, restrictions }) => {
    // TODO: rework this to make it less complex
    // potentially merge into a single map / reduce

    // map input data into the needed format
    // make sure the value is numerical and rounded
    const mapped = data.reduce((acc, { count, value }) => {
      const rounded = Math.round(+value)
      const index = acc.findIndex(({ value: v }) => v === rounded)

      if (index > -1) {
        const newAcc = acc
        newAcc[index].count += count
        return newAcc
      }

      return acc.concat({ count, value: rounded })
    }, [])

    return {
      data: _range(restrictions.min, restrictions.max + 1).map((index) => {
        // try to find an existing value
        const findItem = mapped.find(({ value }) => value === index)

        // either return the existing value or a 0 count
        return findItem || { count: 0, value: index }
      }),
    }
  }),
)(HistogramChart)
