import React from 'react'
import PropTypes from 'prop-types'
import {
  Cell,
  Pie,
  PieChart as PieChartComponent,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import { CHART_COLORS } from '../../../constants'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
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
      <Tooltip />
      <Legend />
      <Pie label data={data} valueKey="count" nameKey="value" fill="#8884d8">
        {data.map((row, index) => (
          <Cell
            key={row.value}
            fill={isSolutionShown && row.correct ? '#00FF00' : CHART_COLORS[index % 5]}
          />
        ))}
      </Pie>
    </PieChartComponent>
  </ResponsiveContainer>
)

PieChart.propTypes = propTypes
PieChart.defaultProps = defaultProps

export default PieChart
