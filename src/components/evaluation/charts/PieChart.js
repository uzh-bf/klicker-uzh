import React from 'react'
import PropTypes from 'prop-types'
import { Cell, Pie, PieChart as PieChartComponent, ResponsiveContainer, LabelList } from 'recharts'
import { withProps } from 'recompose'

import { CHART_COLORS, CHART_TYPES } from '../../../constants'
import { getLabelIn, getLabelOut } from '../../../lib'

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
      <Pie
        labelLine
        data={data}
        fill="#8884d8"
        innerRadius={5}
        isAnimationActive={false}
        nameKey="value"
        valueKey="count"
      >
        <LabelList
          dataKey="labelOut"
          fill="black"
          offset={30}
          position="outside"
          stroke="black"
          strokeWidth={1}
          style={{ fontSize: '2rem' }}
        />
        <LabelList
          dataKey="labelIn"
          fill="white"
          position="inside"
          stroke="white"
          strokeWidth={1}
          style={{ fontSize: '3rem' }}
        />
        {data.map(row => (
          <Cell
            fill={isSolutionShown && row.correct ? '#00FF00' : row.fill}
            key={row.value}
            strokeWidth={5}
          />
        ))}
      </Pie>
    </PieChartComponent>
  </ResponsiveContainer>
)

PieChart.propTypes = propTypes
PieChart.defaultProps = defaultProps

export default withProps(({ data, questionType, totalResponses }) => ({
  // filter out choices without any responses (weird labeling)
  // map data to contain percentages and char labels
  data: data
    .map(({ correct, count, value }, index) => ({
      correct,
      count,
      fill: CHART_COLORS[index % 12],
      labelIn: getLabelIn(CHART_TYPES.PIE_CHART, questionType, count, totalResponses, index),
      labelOut: getLabelOut(CHART_TYPES.PIE_CHART, questionType, count, totalResponses, index),
      value,
    }))
    .filter(({ count }) => count > 0),
}))(PieChart)
