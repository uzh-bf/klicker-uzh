import React from 'react'
import PropTypes from 'prop-types'
import {
  Bar,
  BarChart as BarChartComponent,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  YAxis,
} from 'recharts'
import { withProps } from 'recompose'

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

/*
const renderTooltip = (props) => {
  console.log(props)
  return (
    <div className="tooltip">
      Test
      <style jsx>{`
        .tooltip {
          background-color: white;
          color: red;
        }
      `}</style>
    </div>
  )
} */

const StackChart = ({ isSolutionShown, data }) => (
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
        label={{ angle: -90, position: 'insideLeft', value: 'Participants' }}
      />
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <Bar
        dataKey="count"
        isAnimationActive={false}
        // HACK: don't animate as it causes labels to disappear
        maxBarSize="5rem"
        stackId="a"
      >
        <LabelList
          dataKey="count"
          fill="white"
          position="inside"
          stroke="white"
          style={{ fontSize: '3rem' }}
        />
        {data.map((row, index) => <Cell fill={CHART_COLORS[index % 12]} key={row.value} />)}
      </Bar>

      <Bar
        dataKey="residual"
        isAnimationActive={false}
        // HACK: don't animate as it causes labels to disappear
        maxBarSize="5rem"
        stackId="a"
      >
        <LabelList
          dataKey="residual"
          fill="grey"
          position="inside"
          stroke="grey"
          style={{ fontSize: '3rem' }}
        />
        <LabelList
          fill="black"
          offset={30}
          position="top"
          stroke="black"
          style={{ fontSize: '3rem' }}
          valueAccessor={({ correct, index }) => {
            const label = String.fromCharCode(65 + index)

            if (isSolutionShown) {
              return `${correct ? '✓' : '×'} ${label}`
            }

            return label
          }}
        />
        {data.map(row => <Cell fill="lightgrey" key={row.value} />)}
      </Bar>
    </BarChartComponent>
  </ResponsiveContainer>
)

StackChart.propTypes = propTypes
StackChart.defaultProps = defaultProps

export default withProps(({ data, totalResponses }) => ({
  // filter out choices without any responses (weird labeling)
  // map data to contain percentages and char labels
  data: data.map(({ correct, count, value }, index) => ({
    correct,
    count: count || null, // if count is 0, return null
    index,
    residual: totalResponses - count || null, // if residual is 0, return null
    value,
  })),
}))(StackChart)
