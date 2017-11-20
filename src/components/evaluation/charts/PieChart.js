import React from 'react'
import PropTypes from 'prop-types'
import {
  Cell,
  Pie,
  PieChart as PieChartComponent,
  ResponsiveContainer,
  Tooltip,
  LabelList,
} from 'recharts'
import { withProps } from 'recompose'
import _round from 'lodash/round'

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
    <PieChartComponent
      margin={{
        bottom: 16,
        left: -24,
        right: 24,
        top: 24,
      }}
    >
      <Tooltip />
      <Pie labelLine data={data} fill="#8884d8" nameKey="value" valueKey="count">
        <LabelList
          fill="black"
          offset={20}
          position="outside"
          stroke="black"
          valueAccessor={entry => `${entry.count} | ${entry.percentage}`}
        />
        <LabelList
          dataKey="label"
          fill="white"
          offset={0}
          position="inside"
          stroke="white"
          style={{ fontSize: `${1.75}rem` }}
        />
        {data.map((row, index) => (
          <Cell
            fill={isSolutionShown && row.correct ? '#00FF00' : CHART_COLORS[index % 5]}
            key={row.value}
          />
        ))}
      </Pie>
    </PieChartComponent>
  </ResponsiveContainer>
)

PieChart.propTypes = propTypes
PieChart.defaultProps = defaultProps

export default withProps(({ data, totalResponses }) => ({
  data: data.map(({ correct, count, value }, index) => ({
    correct,
    count,
    label: String.fromCharCode(65 + index),
    percentage: `${_round(100 * (count / totalResponses), 2)} %`,
    value,
  })),
}))(PieChart)
