import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import ElementBarChart from '@klicker-uzh/shared-components/src/charts/ElementBarChart'
import ElementHistogram from '@klicker-uzh/shared-components/src/charts/ElementHistogram'
import ElementTableChart from '@klicker-uzh/shared-components/src/charts/ElementTableChart'
import ElementWordCloud from '@klicker-uzh/shared-components/src/charts/ElementWordcloud'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import EvaluationExplanation from '@klicker-uzh/shared-components/src/evaluation/EvaluationExplanation'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ShowStatisticsType } from './elements/NREvaluation'
import { TextSizeType } from './textSizes'

interface ElementChartProps {
  chartType: string
  instanceEvaluation: ElementInstanceEvaluation
  showSolution: boolean
  showExplanation: boolean
  showStatistics?: ShowStatisticsType
  textSize: TextSizeType
  className?: string
}

function ElementChart({
  chartType,
  instanceEvaluation,
  showSolution,
  showExplanation,
  showStatistics,
  textSize,
  className,
}: ElementChartProps): React.ReactElement {
  const t = useTranslations()
  const router = useRouter()

  if (chartType === ChartType.TABLE) {
    return (
      <ElementTableChart
        instance={instanceEvaluation}
        showSolution={showSolution}
        showExplanation={showExplanation}
        textSize={textSize.text}
        textSizeLg={textSize.textLg}
        className={className}
      />
    )
  } else if (chartType === ChartType.WORD_CLOUD) {
    return (
      <ElementWordCloud
        instance={instanceEvaluation}
        showExplanation={showExplanation}
        textSize={{
          text: textSize.text,
          textLg: textSize.textLg,
          min: textSize.min,
          max: textSize.max,
        }}
        className={className}
        locale={router.locale}
      />
    )
  } else if (chartType === ChartType.BAR_CHART) {
    return (
      <ElementBarChart
        instance={instanceEvaluation}
        showSolution={showSolution}
        showExplanation={showExplanation}
        textSize={textSize}
        className={className}
      />
    )
  } else if (
    chartType === ChartType.HISTOGRAM &&
    instanceEvaluation.__typename === 'NumericalActivityEvaluationData'
  ) {
    const responses = instanceEvaluation.results.responseValues.map(
      (response) => ({
        value: response.value,
        count: response.count,
      })
    )

    return (
      <div className={twMerge('flex h-full w-full flex-col', className)}>
        <EvaluationExplanation
          explanation={instanceEvaluation.explanation}
          showExplanation={showExplanation}
          textSize={textSize.text}
          textSizeLg={textSize.textLg}
        />
        <div className="min-h-0 flex-1">
          <ElementHistogram
            type={instanceEvaluation.type}
            responses={responses}
            solutionRanges={instanceEvaluation.results.solutionRanges ?? []}
            exactSolutions={instanceEvaluation.results.exactSolutions ?? []}
            statistics={instanceEvaluation.statistics}
            minValue={instanceEvaluation.results.minValue}
            maxValue={instanceEvaluation.results.maxValue}
            showSolution={showSolution}
            showStatistics={showStatistics}
            textSize={textSize.text}
          />
        </div>
      </div>
    )
  } else {
    return <div>{t('manage.evaluation.noChartsAvailable')}</div>
  }
}

export default ElementChart
