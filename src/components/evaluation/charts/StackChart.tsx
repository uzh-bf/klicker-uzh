import React from 'react'
import {
  Bar,
  BarChart as BarChartComponent,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  YAxis,
} from 'recharts'
import { CHART_COLORS } from '../../../constants'

interface Props {
  data?: {
    correct?: boolean
    count: number
    value: string
  }[]
  isSolutionShown?: boolean
  totalResponses?: number
}

const defaultProps = {
  data: [],
  isSolutionShown: false,
  totalResponses: 0,
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

function StackChart({ isSolutionShown, data, totalResponses }: Props): React.ReactElement {
  // filter out choices without any responses (weird labeling)
  // map data to contain percentages and char labels
  const processedData = data.map(({ correct, count, value }, index): any => ({
    correct,
    count: count || null, // if count is 0, return null
    fill: CHART_COLORS[index % 12],
    index,
    residual: totalResponses - count || null, // if residual is 0, return null
    value,
  }))

  return (
    <ResponsiveContainer>
      <BarChartComponent
        data={processedData}
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
            (dataMax): number => {
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
          <LabelList dataKey="count" fill="white" position="inside" stroke="white" style={{ fontSize: '3rem' }} />
          {processedData.map(
            (row): React.ReactElement => (
              <Cell fill={row.fill} key={row.value} />
            )
          )}
        </Bar>

        <Bar
          dataKey="residual"
          isAnimationActive={false}
          // HACK: don't animate as it causes labels to disappear
          maxBarSize="5rem"
          stackId="a"
        >
          <LabelList dataKey="residual" fill="grey" position="inside" stroke="grey" style={{ fontSize: '3rem' }} />
          <LabelList
            fill="black"
            offset={30}
            position="top"
            stroke="black"
            style={{ fontSize: '3rem' }}
            valueAccessor={({ correct, index }): string => {
              const label = String.fromCharCode(65 + index)

              if (isSolutionShown) {
                return `${correct ? '✓' : '×'} ${label}`
              }

              return label
            }}
          />
          {processedData.map(
            (row): React.ReactElement => (
              <Cell fill="lightgrey" key={row.value} />
            )
          )}
        </Bar>
      </BarChartComponent>
    </ResponsiveContainer>
  )
}

StackChart.defaultProps = defaultProps

export default StackChart
