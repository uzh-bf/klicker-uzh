import {
  ElementInstanceEvaluation,
  NumericalElementInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { useTranslations } from 'next-intl'
import React from 'react'
import { TextSizeType } from '../sessions/evaluation/constants'
import ElementBarChart from './charts/ElementBarChart'
import ElementHistogram from './charts/ElementHistogram'
import ElementTableChart from './charts/ElementTableChart'
import ElementWordcloud from './charts/ElementWordcloud'

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
        textSize={textSize.textLg}
      />
    )
  } else if (chartType === ChartType.HISTOGRAM) {
    return (
      <ElementHistogram
        instance={instanceEvaluation as NumericalElementInstanceEvaluation}
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
