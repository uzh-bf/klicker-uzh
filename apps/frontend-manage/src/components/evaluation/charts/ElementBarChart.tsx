import {
  ChoicesElementInstanceEvaluation,
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  CHART_COLORS,
  CHART_SOLUTION_COLORS,
  QUESTION_GROUPS,
} from '@klicker-uzh/shared-components/src/constants'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
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
import useEvaluationBarChartData from '../hooks/useEvaluationBarChartData'
import { TextSizeType } from '../textSizes'

interface ElementBarChartProps {
  instance: ElementInstanceEvaluation
  showSolution: boolean
  textSize: TextSizeType
}

function ElementBarChart({
  instance,
  showSolution,
  textSize,
}: ElementBarChartProps) {
  const t = useTranslations()
  const supportedElementTypes = [
    ElementType.Sc,
    ElementType.Mc,
    ElementType.Kprim,
    ElementType.Numerical,
  ]

  const labeledData = useEvaluationBarChartData({ instance })

  if (!supportedElementTypes.includes(instance.type)) {
    return (
      <UserNotification type="warning">
        {t('manage.evaluation.chartTypeNotSupported')}
      </UserNotification>
    )
  }

  return (
    <ResponsiveContainer className="pb-2" height="99%" width="99%">
      <BarChartRecharts
        data={labeledData}
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
          isAnimationActive={false}
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
          {QUESTION_GROUPS.CHOICES.includes(instance.type) &&
            (instance as ChoicesElementInstanceEvaluation).results.choices.map(
              (choice, index) => (
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

export default ElementBarChart
