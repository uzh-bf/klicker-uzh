import { QuestionType } from '@klicker-uzh/prisma'
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
  SMALL_BAR_THRESHOLD,
} from 'shared-components/src/constants'

interface BarChartProps {
  questionType: QuestionType
  answers: { value: string; correct?: boolean; count: number }[]
  showSolution: boolean
  totalResponses: number
}

function BarChart({
  questionType,
  answers,
  showSolution,
  totalResponses,
}: BarChartProps): React.ReactElement {
  // add labelIn and labelOut attributes to data, set labelIn to votes if votes/totalResponses > SMALL_BAR_THRESHOLD and set labelOut to votes otherwise
  const dataWithLabels = answers.map((d, idx) => {
    const labelIn =
      d.count / totalResponses > SMALL_BAR_THRESHOLD ? d.count : undefined
    const labelOut =
      d.count / totalResponses <= SMALL_BAR_THRESHOLD ? d.count : undefined
    const xLabel =
      questionType === 'NUMERICAL'
        ? d.value
        : String.fromCharCode(Number(idx) + 65)
    return { count: d.count, labelIn, labelOut, xLabel }
  })

  // debugger

  // TODO: readd ResponsiveContainer to allow resizing with sizeMe component on level above <ResponsiveContainer><BarChartRecharts>...</BarChartRecharts></ResponsiveContainer>
  return (
    <ResponsiveContainer height={600} className="z-10">
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
          {answers.map(
            (row, index): React.ReactElement => (
              <Cell
                fill={
                  showSolution && row.correct
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
