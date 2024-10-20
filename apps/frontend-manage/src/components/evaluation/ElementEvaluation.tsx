import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import CTEvaluation from './elements/CTEvaluation'
import ChoicesEvaluation from './elements/ChoicesEvaluation'
import FCEvaluation from './elements/FCEvaluation'
import FTEvaluation from './elements/FTEvaluation'
import NREvaluation from './elements/NREvaluation'
import QuestionCollapsible from './elements/QuestionCollapsible'
import { TextSizeType } from './textSizes'

interface ElementEvaluationProps {
  currentInstance: ElementInstanceEvaluation
  activeInstance: number
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  className?: string
}

function ElementEvaluation({
  currentInstance,
  activeInstance,
  textSize,
  chartType,
  showSolution,
  className,
}: ElementEvaluationProps) {
  return (
    <div className={twMerge('flex h-full flex-col', className)}>
      <div className="flex-none">
        <QuestionCollapsible
          activeInstance={activeInstance}
          currentInstance={currentInstance}
          proseSize={textSize.prose}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {currentInstance.__typename === 'ChoicesElementInstanceEvaluation' && (
          <ChoicesEvaluation
            instanceEvaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
          />
        )}
        {currentInstance.__typename ===
          'NumericalElementInstanceEvaluation' && (
          <NREvaluation
            instanceEvaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
          />
        )}
        {currentInstance.__typename === 'FreeElementInstanceEvaluation' && (
          <FTEvaluation
            instanceEvaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
          />
        )}
        {currentInstance.__typename ===
          'FlashcardElementInstanceEvaluation' && (
          <FCEvaluation evaluation={currentInstance} />
        )}
        {currentInstance.__typename === 'ContentElementInstanceEvaluation' && (
          <CTEvaluation evaluation={currentInstance} />
        )}
      </div>
    </div>
  )
}

export default ElementEvaluation
