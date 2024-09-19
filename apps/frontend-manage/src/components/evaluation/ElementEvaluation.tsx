import {
  ElementInstanceEvaluation,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import CTEvaluation from './elements/CTEvaluation'
import FCEvaluation from './elements/FCEvaluation'
import FTEvaluation from './elements/FTEvaluation'
import KPRIMEvaluation from './elements/KPRIMEvaluation'
import MCEvaluation from './elements/MCEvaluation'
import NREvaluation from './elements/NREvaluation'
import QuestionCollapsible from './elements/QuestionCollapsible'
import SCEvaluation from './elements/SCEvaluation'
import { TextSizeType } from './textSizes'

interface ElementEvaluationProps {
  currentInstance: ElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  className?: string
}

function ElementEvaluation({
  currentInstance,
  textSize,
  chartType,
  showSolution,
  className,
}: ElementEvaluationProps) {
  return (
    <div className={twMerge('flex h-full flex-col', className)}>
      <div className="flex-none">
        <QuestionCollapsible
          currentInstance={currentInstance}
          proseSize={textSize.prose}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {currentInstance.type === ElementType.Sc && (
          <SCEvaluation
            evaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
          />
        )}
        {currentInstance.type === ElementType.Mc && (
          <MCEvaluation evaluation={currentInstance} />
        )}
        {currentInstance.type === ElementType.Kprim && (
          <KPRIMEvaluation evaluation={currentInstance} />
        )}
        {currentInstance.type === ElementType.Numerical && (
          <NREvaluation evaluation={currentInstance} />
        )}
        {currentInstance.type === ElementType.FreeText && (
          <FTEvaluation evaluation={currentInstance} />
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
