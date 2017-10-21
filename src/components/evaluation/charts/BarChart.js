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
  choices: PropTypes.array,
  isSolutionShown: PropTypes.bool,
}

const defaultProps = {
  choices: [],
  isSolutionShown: false,
}

const BarChart = ({ isSolutionShown, choices }) => (
  <ResponsiveContainer width="80%">
    <BarChartComponent data={choices}>
      <XAxis dataKey="name" />
      <YAxis />
      <CartesianGrid strokeDasharray="3 3" />
      <Tooltip />
      <Legend />
      <Bar dataKey="count">
        {choices.map(choice => (
          <Cell key={choice.id} fill={isSolutionShown && choice.correct ? '#00FF00' : '#8884d8'} />
        ))}
      </Bar>
    </BarChartComponent>
  </ResponsiveContainer>
)

BarChart.propTypes = propTypes
BarChart.defaultProps = defaultProps

export default BarChart
