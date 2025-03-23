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
    <div className="flex-1 px-4">
      <ElementChart
        chartType={chartType}
        instanceEvaluation={instanceEvaluation}
        showSolution={showSolution}
        showExplanation={showExplanation}
        textSize={textSize}
      />
    </div>
  )
}

export default SEEvaluation
