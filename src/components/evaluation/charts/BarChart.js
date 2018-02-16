import React from 'react'
import PropTypes from 'prop-types'
import _sortBy from 'lodash/sortBy'
import {
  Bar,
  BarChart as BarChartComponent,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { withProps } from 'recompose'
import _round from 'lodash/round'

import { CHART_COLORS, QUESTION_TYPES } from '../../../constants'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  isSolutionShown: PropTypes.bool,
  isColored: PropTypes.bool,
}

const defaultProps = {
  data: [],
  isColored: true,
  isSolutionShown: false,
}

const BarChart = ({ isSolutionShown, data, isColored }) => (
  <ResponsiveContainer>
    <BarChartComponent
      data={data}
      margin={{
        bottom: 24,
        left: 24,
        right: 24,
        top: 24,
      }}
    >
      <XAxis
        dataKey="label"
        tick={{
          fill: 'black',
          offset: 30,
          stroke: 'black',
          style: { fontSize: '2.5rem' },
        }}
      />
      <YAxis
        domain={[
          0,
          (dataMax) => {
            const rounded = Math.ceil(dataMax * 1.1)

            if (rounded % 2 === 0) {
              return rounded
            }

            return rounded + 1
          },
        ]}
        label={{ angle: -90, position: 'insideLeft', value: 'Responses' }}
      />
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <Bar
        dataKey="count"
        isAnimationActive={false}
        // HACK: don't animate as it causes labels to disappear
        maxBarSize="5rem"
      >
        <LabelList
          dataKey="percentage"
          fill="white"
          position="inside"
          stroke="white"
          style={{ fontSize: '2.5rem' }}
        />
        {data.map((row, index) => (
          <Cell
            fill={
              isSolutionShown && row.correct // eslint-disable-line
                ? '#00FF00'
                : isColored ? CHART_COLORS[index % 12] : '#1395BA'
            }
            key={row.value}
          />
        ))}
      </Bar>
    </BarChartComponent>
  </ResponsiveContainer>
)

BarChart.propTypes = propTypes
BarChart.defaultProps = defaultProps

export default withProps(({ data, questionType, totalResponses }) => ({
  // filter out choices without any responses (weird labeling)
  // map data to contain percentages and char labels
  data: _sortBy(
    data.map(({ correct, count, value }, index) => ({
      correct,
      count,
      label: questionType === 'FREE_RANGE' ? +value : String.fromCharCode(65 + index),
      percentage:
        questionType === QUESTION_TYPES.SC
          ? `${count} | ${_round(100 * (count / totalResponses), 2)} %`
          : count,
      value,
    })),
    o => o.label,
  ),
}))(BarChart)
