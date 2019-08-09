import React from 'react'
import { Cell, Pie, PieChart as PieChartComponent, ResponsiveContainer, LabelList } from 'recharts'

import { CHART_COLORS, CHART_TYPES } from '../../../constants'
import { getLabelIn, getLabelOut } from '../../../lib/utils/charts'

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

function PieChart({ isSolutionShown, data, totalResponses }: Props): React.ReactElement {
  // filter out choices without any responses (weird labeling)
  // map data to contain percentages and char labels
  const processedData = data
    .map(({ correct, count, value }, index) => ({
      correct,
      count,
      fill: CHART_COLORS[index % 12],
      labelIn: getLabelIn(CHART_TYPES.PIE_CHART, count, totalResponses, index),
      labelOut: getLabelOut(CHART_TYPES.PIE_CHART, count, totalResponses, index),
      value,
    }))
    .filter(({ count }) => count > 0)

  return (
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
          data={processedData}
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
          {processedData.map(row => (
            <Cell fill={isSolutionShown && row.correct ? '#00FF00' : row.fill} key={row.value} strokeWidth={5} />
          ))}
        </Pie>
      </PieChartComponent>
    </ResponsiveContainer>
  )
}

PieChart.defaultProps = defaultProps

export default PieChart
