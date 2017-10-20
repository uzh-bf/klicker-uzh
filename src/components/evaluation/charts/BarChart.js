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
  isSolutionShown: PropTypes.bool,
  results: PropTypes.object.isRequired,
}

const defaultProps = {
  isSolutionShown: false,
}

const BarChart = ({ isSolutionShown, results }) => (
  <ResponsiveContainer width="80%">
    <BarChartComponent data={results.options}>
      <XAxis dataKey="name" />
      <YAxis />
      <CartesianGrid strokeDasharray="3 3" />
      <Tooltip />
      <Legend />
      <Bar dataKey="numberOfVotes">
        {results.options.map(option => (
          <Cell key={option.id} fill={isSolutionShown && option.correct ? '#00FF00' : '#8884d8'} />
        ))}
      </Bar>
    </BarChartComponent>
  </ResponsiveContainer>
)

BarChart.propTypes = propTypes
BarChart.defaultProps = defaultProps

export default BarChart
