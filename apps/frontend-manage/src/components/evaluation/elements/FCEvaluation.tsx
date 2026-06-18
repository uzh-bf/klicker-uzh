import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { FlashcardActivityEvaluationData } from '@lib/evaluationTypes'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import FlashcardContentCollapsible from './FlashcardContentCollapsible'

interface FCEvaluationProps {
  evaluation: FlashcardActivityEvaluationData
  textSize: TextSizeType
  chartType: ChartType
}

function FCEvaluation({ evaluation, textSize, chartType }: FCEvaluationProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-none">
        <FlashcardContentCollapsible
          content={evaluation.content}
          explanation={evaluation.explanation!}
          proseSize={textSize.prose}
        />
      </div>
      <div className="min-h-0 flex-1 px-4 py-2">
        <ElementChart
          chartType={chartType}
          instanceEvaluation={evaluation}
          showSolution={false}
          showExplanation={false}
          textSize={textSize}
        />
      </div>
    </div>
  )
}

export default FCEvaluation
