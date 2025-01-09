import { SelectionElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'

interface SEEvaluationProps {
  instanceEvaluation: SelectionElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
}

function SEEvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
}: SEEvaluationProps) {
  return (
    <div className="flex-1 px-4">
      <ElementChart
        chartType={chartType}
        instanceEvaluation={instanceEvaluation}
        showSolution={showSolution}
        textSize={textSize}
      />
    </div>
  )
}

export default SEEvaluation
