import React from 'react'
import PropTypes from 'prop-types'
import { Cell, Pie, PieChart as PieChartComponent, ResponsiveContainer } from 'recharts'

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

const PieChart = ({ isSolutionShown, data }) => (
  <ResponsiveContainer>
    <PieChartComponent>
      <Pie label data={data} valueKey="count" fill="#8884d8">
        {data.map(row => (
          <Cell key={row.value} fill={isSolutionShown && row.correct ? '#00FF00' : '#8884d8'} />
        ))}
      </Pie>
    </PieChartComponent>
  </ResponsiveContainer>
)

PieChart.propTypes = propTypes
PieChart.defaultProps = defaultProps

export default PieChart
