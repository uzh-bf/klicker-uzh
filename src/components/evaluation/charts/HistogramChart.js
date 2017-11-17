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
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const propTypes = {
  brush: PropTypes.shape({
    endIndex: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
    startIndex: PropTypes.number.isRequired,
  }),
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  restrictions: PropTypes.shape({
    max: PropTypes.number,
    min: PropTypes.number,
  }),
  statistics: PropTypes.shape({
    mean: PropTypes.number.isRequired,
    median: PropTypes.number.isRequired,
  }),
}

const defaultProps = {
  brush: undefined,
  data: [],
  restrictions: undefined,
  statistics: undefined,
}

const HistogramChart = ({ brush, data, statistics }) => (
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
      <CartesianGrid strokeDasharray="3 3" />
      <Tooltip />
      <Bar dataKey="count" fill="#8884d8" />

      {statistics && [
        <ReferenceLine x={statistics.mean} label="Mean" stroke="green" />,
        <ReferenceLine x={statistics.median} label="Median" stroke="red" />,
      ]}

      {brush && <Brush {...brush} dataKey="value" height={30} stroke="#8884d8" />}
    </BarChart>
  </ResponsiveContainer>
)

HistogramChart.propTypes = propTypes
HistogramChart.defaultProps = defaultProps

export default compose(
  withProps(({ data, restrictions }) => {
    // map input data into the needed format
    // make sure the value is numerical
    const mapped = data.map(({ count, value }) => ({ count, value: +value }))

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
