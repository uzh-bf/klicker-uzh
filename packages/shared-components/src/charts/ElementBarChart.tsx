import {
  type ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
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
import { twMerge } from 'tailwind-merge'
import { CHART_COLORS, CHART_SOLUTION_COLORS } from '../constants'
import EvaluationExplanation from '../evaluation/EvaluationExplanation'
import useEvaluationBarChartData from '../hooks/useEvaluationBarChartData'

interface ElementBarChartProps {
  instance: ElementInstanceEvaluation
  showSolution: boolean
  showExplanation: boolean
  textSize: {
    legend: string
    legendMd: string
    text: string
    textLg: string
    textXl: string
    text3Xl: string
  }
  className?: string
}

function ElementBarChart({
  instance,
  showSolution,
  showExplanation,
  textSize,
  className,
}: ElementBarChartProps) {
  const t = useTranslations()
  const supportedElementTypes = [
    ElementType.Sc,
    ElementType.Mc,
    ElementType.Kprim,
    ElementType.Numerical,
    ElementType.Flashcard,
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
    <div className={twMerge('flex h-full w-full flex-col', className)}>
      <EvaluationExplanation
        explanation={instance.explanation}
        showExplanation={showExplanation}
        textSize={textSize.text}
        textSizeLg={textSize.textLg}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="99%" height="100%">
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
                style: {
                  fontSize:
                    instance.__typename === 'FlashcardActivityEvaluationData'
                      ? textSize.legendMd
                      : textSize.legend,
                },
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
                style: { textAnchor: 'middle' },
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
              {instance.__typename === 'ChoicesActivityEvaluationData' &&
                instance.results.choices.map((choice, index) => (
                  <Cell
                    fill={
                      showSolution
                        ? choice.correct
                          ? CHART_SOLUTION_COLORS.correct
                          : CHART_SOLUTION_COLORS.incorrect
                        : CHART_COLORS[index % 12]
                    }
                    key={choice.ix}
                  />
                ))}
              {instance.__typename === 'FlashcardActivityEvaluationData' && (
                <>
                  <Cell fill="#cc0000" key={0} />
                  <Cell fill="#ff9900" key={1} />
                  <Cell fill="#00b20a" key={2} />
                </>
              )}
            </Bar>
          </BarChartRecharts>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ElementBarChart
