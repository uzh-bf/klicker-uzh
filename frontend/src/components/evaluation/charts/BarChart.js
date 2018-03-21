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

import { CHART_COLORS, CHART_TYPES } from '../../../constants'
import { indexToLetter, getLabelIn, getLabelOut } from '../../../lib'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  isColored: PropTypes.bool,
  isSolutionShown: PropTypes.bool,
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
          dataKey="labelOut"
          fill="black"
          offset={15}
          position="top"
          stroke="black"
          strokeWidth={1}
          style={{ fontSize: '2rem' }}
        />
        <LabelList
          dataKey="labelIn"
          fill="white"
          position="inside"
          stroke="white"
          style={{ fontSize: '2.5rem' }}
        />
        {data.map(row => (
          <Cell
            fill={
              isSolutionShown && row.correct // eslint-disable-line
                ? '#00FF00'
                : isColored ? row.fill : '#1395BA'
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
      fill: CHART_COLORS[index % 12],
      label: questionType === 'FREE_RANGE' ? +value : indexToLetter(index),
      labelIn: getLabelIn(CHART_TYPES.BAR_CHART, questionType, count, totalResponses, index),
      labelOut: getLabelOut(CHART_TYPES.BAR_CHART, questionType, count, totalResponses, index),
      value,
    })),
    o => o.label,
  ),
}))(BarChart)
