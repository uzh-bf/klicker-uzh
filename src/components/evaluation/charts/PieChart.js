import React from 'react'
import PropTypes from 'prop-types'
import { Cell, Pie, PieChart as PieChartComponent, ResponsiveContainer } from 'recharts'

const propTypes = {
  choices: PropTypes.array,
  isSolutionShown: PropTypes.bool,
}

const defaultProps = {
  choices: [],
  isSolutionShown: false,
}

const PieChart = ({ isSolutionShown, choices }) => (
  <ResponsiveContainer>
    <PieChartComponent>
      <Pie label data={choices} valueKey="count" fill="#8884d8">
        {choices.map(choice => (
          <Cell key={choice.id} fill={isSolutionShown && choice.correct ? '#00FF00' : '#8884d8'} />
        ))}
      </Pie>
    </PieChartComponent>
  </ResponsiveContainer>
)

PieChart.propTypes = propTypes
PieChart.defaultProps = defaultProps

export default PieChart
