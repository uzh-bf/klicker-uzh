import { Choice, InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import React from 'react'
import {
  Bar,
  BarChart as BarChartRecharts,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_COLORS,
  QUESTION_GROUPS,
  SMALL_BAR_THRESHOLD,
} from 'shared-components/src/constants'

interface BarChartProps {
  data: InstanceResult
  showSolution: boolean
}

function BarChart({ data, showSolution }: BarChartProps): React.ReactElement {
  // add labelIn and labelOut attributes to data, set labelIn to votes if votes/totalResponses > SMALL_BAR_THRESHOLD and set labelOut to votes otherwise
  const dataWithLabels = Object.values(data.results).map((result, idx) => {
    const labelIn =
      result.count / data.participants > SMALL_BAR_THRESHOLD
        ? result.count
        : undefined
    const labelOut =
      result.count / data.participants <= SMALL_BAR_THRESHOLD
        ? result.count
        : undefined
    const xLabel =
      data.questionData.type === 'NUMERICAL'
        ? result.value
        : String.fromCharCode(Number(idx) + 65)
    return { count: result.count, labelIn, labelOut, xLabel }
  })

  // debugger

  // TODO: readd ResponsiveContainer to allow resizing with sizeMe component on level above <ResponsiveContainer><BarChartRecharts>...</BarChartRecharts></ResponsiveContainer>
  return (
    <ResponsiveContainer className="mb-4" height={600} width="99%">
      <BarChartRecharts
        data={dataWithLabels}
        margin={{
          bottom: 20,
          left: 20,
          right: 20,
          top: 20,
        }}
      >
        <XAxis
          dataKey="xLabel"
          tick={{
            fill: 'black',
            offset: 30,
            stroke: 'black',
            style: { fontSize: '2rem' },
          }}
        />
        <YAxis
          domain={[
            0,
            (dataMax: number): number => {
              const rounded = Math.ceil(dataMax * 1.1)
              if (rounded % 2 === 0) {
                return rounded
              }
              return rounded + 1
            },
          ]}
          label={{ angle: -90, position: 'insideLeft', value: 'Antworten' }}
        />
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <Bar
          dataKey="count"
          // HACK: don't animate as it causes labels to disappear
          //isAnimationActive={false}
          maxBarSize={100}
        >
          <LabelList
            dataKey="labelOut"
            fill="black"
            offset={15}
            position="top"
            stroke="black"
            strokeWidth={1}
            style={{ fontSize: '1.5rem' }}
          />
          <LabelList
            dataKey="labelIn"
            fill="white"
            position="inside"
            stroke="white"
            style={{ fontSize: '2rem' }}
          />
          {QUESTION_GROUPS.CHOICES.includes(data.questionData.type) &&
            data.questionData.options.choices.map(
              (choice: Choice, index: number): React.ReactElement => (
                <Cell
                  fill={
                    showSolution && choice.correct
                      ? '#00de0d'
                      : CHART_COLORS[index % 12]
                  }
                  key={index}
                />
              )
            )}
        </Bar>
      </BarChartRecharts>
    </ResponsiveContainer>
  )
}

export default BarChart
