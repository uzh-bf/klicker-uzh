import {
  ChoicesElementInstanceEvaluation,
  ElementInstanceEvaluation,
  ElementType,
  FreeElementInstanceEvaluation,
  NumericalElementInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ChartType,
  QUESTION_GROUPS,
} from '@klicker-uzh/shared-components/src/constants'
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
        {QUESTION_GROUPS.CHOICES.includes(currentInstance.type) && (
          <ChoicesEvaluation
            instanceEvaluation={
              currentInstance as ChoicesElementInstanceEvaluation
            }
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
          />
        )}
        {currentInstance.type === ElementType.Numerical && (
          <NREvaluation
            instanceEvaluation={
              currentInstance as NumericalElementInstanceEvaluation
            }
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
          />
        )}
        {currentInstance.type === ElementType.FreeText && (
          <FTEvaluation
            instanceEvaluation={
              currentInstance as FreeElementInstanceEvaluation
            }
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
          />
        )}
        {currentInstance.type === ElementType.Flashcard && (
          <FCEvaluation evaluation={currentInstance} />
        )}
        {currentInstance.type === ElementType.Content && (
          <CTEvaluation evaluation={currentInstance} />
        )}
      </div>
    </div>
  )
}

export default ElementEvaluation
