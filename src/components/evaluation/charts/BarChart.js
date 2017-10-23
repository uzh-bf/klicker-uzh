import React from 'react'
import PropTypes from 'prop-types'
import {
  Bar,
  BarChart as BarChartComponent,
  CartesianGrid,
  Cell,
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
      text: PropTypes.string.isRequired,
    }),
  ),
  isSolutionShown: PropTypes.bool,
}

const defaultProps = {
  data: [],
  isSolutionShown: false,
}

const BarChart = ({ isSolutionShown, data }) => (
  <ResponsiveContainer width="80%">
    <BarChartComponent data={data}>
      <XAxis dataKey="value" />
      <YAxis />
      <CartesianGrid strokeDasharray="3 3" />
      <Tooltip />
      <Legend />
      <Bar dataKey="count">
        {data.map(row => (
          <Cell key={row.value} fill={isSolutionShown && row.correct ? '#00FF00' : '#8884d8'} />
        ))}
      </Bar>
    </BarChartComponent>
  </ResponsiveContainer>
)

BarChart.propTypes = propTypes
BarChart.defaultProps = defaultProps

export default BarChart
