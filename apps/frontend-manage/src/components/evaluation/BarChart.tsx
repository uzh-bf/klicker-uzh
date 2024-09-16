import {
  Choice,
  ChoicesQuestionData,
  InstanceResult,
} from '@klicker-uzh/graphql/dist/ops'
import {
  CHART_COLORS,
  CHART_SOLUTION_COLORS,
  QUESTION_GROUPS,
  SMALL_BAR_THRESHOLD,
} from '@klicker-uzh/shared-components/src/constants'
import { useTranslations } from 'next-intl'
import React, { useMemo } from 'react'
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
import { TextSizeType } from '../sessions/evaluation/constants'

interface BarChartProps {
  data: InstanceResult
  showSolution: boolean
  textSize: Partial<TextSizeType>
}

function BarChart({
  data,
  showSolution,
  textSize,
}: BarChartProps): React.ReactElement {
  const t = useTranslations()

  // add labelIn and labelOut attributes to data, set labelIn to votes if votes/totalResponses > SMALL_BAR_THRESHOLD and set labelOut to votes otherwise
  const dataWithLabels = useMemo(() => {
    const labeledData = Object.values(
      data.results as Record<string, { count: number; value: string }>
    ).map((result, idx) => {
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
          ? Math.round(parseFloat(result.value) * 100) / 100
          : String.fromCharCode(Number(idx) + 65)
      return { count: result.count, labelIn, labelOut, xLabel }
    })
    return labeledData.length > 0
      ? labeledData
      : [
          {
            count: 0,
            labelIn: undefined,
            labelOut: undefined,
            xLabel: '0',
          },
        ]
  }, [data.results, data.participants, data.questionData.type])

  return (
    <ResponsiveContainer className="pb-2" height="99%" width="99%">
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
            style: { fontSize: textSize.legend },
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
          label={{
            angle: -90,
            position: 'insideLeft',
            value: t('shared.generic.responses'),
            className: textSize.textXl,
          }}
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
            className={textSize.text3Xl}
          />
          <LabelList
            dataKey="labelIn"
            fill="white"
            position="inside"
            stroke="white"
            className={textSize.text3Xl}
            id="bar-chart-block"
          />
          {QUESTION_GROUPS.CHOICES.includes(data.questionData.type) &&
            (data.questionData as ChoicesQuestionData).options.choices.map(
              (choice: Choice, index: number): React.ReactElement => (
                <Cell
                  fill={
                    showSolution
                      ? choice.correct
                        ? CHART_SOLUTION_COLORS.correct
                        : CHART_SOLUTION_COLORS.incorrect
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
