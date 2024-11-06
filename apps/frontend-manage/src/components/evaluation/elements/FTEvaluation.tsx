import { FreeElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import FTSidebar from './FTSidebar'

interface FTEvaluationProps {
  instanceEvaluation: FreeElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  type: ActivityEvaluationType
}

function FTEvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
  type,
}: FTEvaluationProps) {
  return (
    <>
      <div className="order-2 flex-1 px-4 md:order-1">
        <ElementChart
          chartType={chartType}
          instanceEvaluation={instanceEvaluation}
          showSolution={showSolution}
          textSize={textSize}
        />
      </div>
      {instanceEvaluation.results.solutions && showSolution && (
        <FTSidebar
          instance={instanceEvaluation}
          textSize={textSize}
          showSolution={showSolution}
          type={type}
        />
      )}
    </>
  )
}

export default FTEvaluation
