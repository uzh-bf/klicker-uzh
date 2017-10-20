import React from 'react'
import PropTypes from 'prop-types'
import { Cell, Pie, PieChart as PieChartComponent, ResponsiveContainer } from 'recharts'

const propTypes = {
  isSolutionShown: PropTypes.bool,
  results: PropTypes.object.isRequired,
}

const defaultProps = {
  isSolutionShown: false,
}

const PieChart = ({ isSolutionShown, results }) => (
  <ResponsiveContainer>
    <PieChartComponent>
      <Pie label data={results.options} valueKey="numberOfVotes" fill="#8884d8">
        {results.options.map((option, index) => (
          <Cell key={index} fill={isSolutionShown && option.correct ? '#00FF00' : '#8884d8'} />
        ))}
      </Pie>
    </PieChartComponent>
  </ResponsiveContainer>
)

PieChart.propTypes = propTypes
PieChart.defaultProps = defaultProps

export default PieChart
