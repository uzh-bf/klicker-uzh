import React from 'react'
import PropTypes from 'prop-types'
import { Cell, Pie, PieChart as PieChartComponent, ResponsiveContainer, LabelList } from 'recharts'
import { withProps } from 'recompose'
import _round from 'lodash/round'

import { CHART_COLORS, SMALL_PIE_THRESHOLD } from '../../../constants'
import { indexToLetter } from '../../../lib'

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
          dataKey="percentage"
          fill="black"
          offset={30}
          position="outside"
          stroke="black"
          strokeWidth={1}
          style={{ fontSize: '2rem' }}
        />
        <LabelList
          dataKey="label"
          fill="white"
          position="inside"
          stroke="white"
          strokeWidth={1}
          style={{ fontSize: '3rem' }}
        />
        {data.map((row, index) => (
          <Cell
            fill={isSolutionShown && row.correct ? '#00FF00' : CHART_COLORS[index % 12]}
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

// determine whether the label (A,B, ...) is displayed within the pie or not
const labelText = (count, totalResponses, index) => {
  if (count / totalResponses < SMALL_PIE_THRESHOLD) {
    return ''
  }
  return `${indexToLetter(index)}`
}

// determine whether the label (A,B, ...) is displayed outside the pie or not
// and add number of responses and percentual responses
const percentageText = (count, totalResponses, index) => {
  if (count / totalResponses > SMALL_PIE_THRESHOLD) {
    return `${count} | ${_round(100 * (count / totalResponses), 1)} %`
  }
  return `${count} | ${_round(100 * (count / totalResponses), 1)} % (${indexToLetter(index)})`
}

export default withProps(({ data, totalResponses }) => ({
  // filter out choices without any responses (weird labeling)
  // map data to contain percentages and char labels
  data: data.filter(({ count }) => count > 0).map(({ correct, count, value }, index) => ({
    correct,
    count,
    label: labelText(count, totalResponses, index),
    percentage: percentageText(count, totalResponses, index),
    value,
  })),
}))(PieChart)
