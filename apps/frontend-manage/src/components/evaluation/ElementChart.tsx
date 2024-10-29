import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import ElementBarChart from '@klicker-uzh/shared-components/src/charts/ElementBarChart'
import ElementHistogram from '@klicker-uzh/shared-components/src/charts/ElementHistogram'
import ElementTableChart from '@klicker-uzh/shared-components/src/charts/ElementTableChart'
import ElementWordcloud from '@klicker-uzh/shared-components/src/charts/ElementWordcloud'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { useTranslations } from 'next-intl'
import React from 'react'
import { TextSizeType } from '../sessions/evaluation/constants'

interface ElementChartProps {
  chartType: string
  instanceEvaluation: ElementInstanceEvaluation
  showSolution: boolean
  textSize: TextSizeType
}

function ElementChart({
  chartType,
  instanceEvaluation,
  showSolution,
  textSize,
}: ElementChartProps): React.ReactElement {
  const t = useTranslations()

  if (chartType === ChartType.TABLE) {
    return (
      <ElementTableChart
        instance={instanceEvaluation}
        showSolution={showSolution}
        textSize={textSize.text}
      />
    )
  } else if (
    chartType === ChartType.HISTOGRAM &&
    instanceEvaluation.__typename === 'NumericalElementInstanceEvaluation'
  ) {
    const responses = instanceEvaluation.results.responseValues.map(
      (response) => ({
        value: response.value,
        count: response.count,
      })
    )

    return (
      <ElementHistogram
        type={instanceEvaluation.type}
        responses={responses}
        solutionRanges={instanceEvaluation.results.solutionRanges}
        minValue={instanceEvaluation.results.minValue}
        maxValue={instanceEvaluation.results.maxValue}
        showSolution={{ general: showSolution }}
        textSize={textSize.text}
      />
    )
  } else if (chartType === ChartType.WORD_CLOUD) {
    return (
      <ElementWordcloud
        instance={instanceEvaluation}
        showSolution={showSolution}
        textSize={{ min: textSize.min, max: textSize.max }}
      />
    )
  } else if (chartType === ChartType.BAR_CHART) {
    return (
      <ElementBarChart
        instance={instanceEvaluation}
        showSolution={showSolution}
        textSize={textSize}
      />
    )
  } else {
    return <div>{t('manage.evaluation.noChartsAvailable')}</div>
  }
}

export default ElementChart
