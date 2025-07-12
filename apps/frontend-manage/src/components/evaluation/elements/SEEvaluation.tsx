import { SelectionActivityEvaluationData } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'

interface SEEvaluationProps {
  instanceEvaluation: SelectionActivityEvaluationData
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
}

function SEEvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
  showExplanation,
}: SEEvaluationProps) {
  return (
    <ElementChart
      chartType={chartType}
      instanceEvaluation={instanceEvaluation}
      showSolution={showSolution}
      showExplanation={showExplanation}
      textSize={textSize}
      className="px-4"
    />
  )
}

export default SEEvaluation
