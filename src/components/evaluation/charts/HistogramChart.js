/* eslint-disable no-mixed-operators,no-plusplus,no-loop-func */
import React from 'react'
import PropTypes from 'prop-types'
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
}

const defaultProps = {
  data: [],
  restrictions: null,
}

const HistogramChart = ({ data, restrictions }) => {
  // TODO comments
  const histogramArray = []
  let currentValue = restrictions.min
  for (let i = 0; i < restrictions.max - restrictions.min + 1; i++) {
    histogramArray[i] = data.find(obj => +obj.value === currentValue)
      ? { count: data.find(obj => +obj.value === currentValue).count, value: currentValue }
      : { count: 0, value: currentValue }
    currentValue += 1
  }

  return (
    <ResponsiveContainer width="80%">
      <BarChart
        width={600}
        height={300}
        data={histogramArray}
        margin={{
          bottom: 5,
          left: 20,
          right: 30,
          top: 5,
        }}
      >
        <XAxis dataKey="value" />
        <YAxis />
        <CartesianGrid strokeDasharray="3 3" />
        <Tooltip />
        <Legend verticalAlign="top" wrapperStyle={{ lineHeight: '40px' }} />
        <ReferenceLine y={0} stroke="#000" />
        <Brush dataKey="value" height={30} stroke="#8884d8" />
        <Bar dataKey="count" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  )
}

HistogramChart.propTypes = propTypes
HistogramChart.defaultProps = defaultProps

export default HistogramChart
