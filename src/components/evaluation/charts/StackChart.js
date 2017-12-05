import React from 'react'
import PropTypes from 'prop-types'
import {
  Bar,
  BarChart as BarChartComponent,
  CartesianGrid,
  Cell,
  LabelList,
  Label,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
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
      <XAxis dataKey="label">
        <Label offset={0} position="insideBottom" value="Choices" />
      </XAxis>
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
      <Tooltip />
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
        {data.map((row, index) => (
          <Cell
            fill={isSolutionShown ? (row.correct ? 'green' : CHART_COLORS[index % 12]) : 'green'}
            key={row.value}
          />
        ))}
      </Bar>

      <Bar dataKey="residual" stackId="a">
        <LabelList
          dataKey="residual"
          fill="white"
          position="inside"
          stroke="white"
          style={{ fontSize: '3rem' }}
        />
        <LabelList
          dataKey="label"
          fill="black"
          offset={30}
          position="top"
          stroke="black"
          style={{ fontSize: '1.5rem' }}
        />
        {data.map((row, index) => (
          <Cell
            fill={isSolutionShown ? (!row.correct ? 'green' : CHART_COLORS[index % 12]) : 'red'}
            key={row.value}
          />
        ))}
      </Bar>
    </BarChartComponent>
  </ResponsiveContainer>
)

StackChart.propTypes = propTypes
StackChart.defaultProps = defaultProps

export default withProps(({ data, totalResponses }) => ({
  // filter out choices without any responses (weird labeling)
  // map data to contain percentages and char labels
  data: data.filter(({ count }) => count > 0).map(({ correct, count, value }, index) => ({
    correct,
    count,
    count_correct: correct ? count : totalResponses - count,
    count_wrong: correct ? totalResponses - count : count,
    label: String.fromCharCode(65 + index),
    percentage: `${count} | ${_round(100 * (count / totalResponses), 2)} %`,
    residual: totalResponses - count,
    value,
  })),
}))(StackChart)
