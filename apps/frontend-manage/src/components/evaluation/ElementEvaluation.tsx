import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from './ActivityEvaluation'
import CSEvaluation from './elements/CSEvaluation'
import CTEvaluation from './elements/CTEvaluation'
import ChoicesEvaluation from './elements/ChoicesEvaluation'
import FCEvaluation from './elements/FCEvaluation'
import FTEvaluation from './elements/FTEvaluation'
import NREvaluation from './elements/NREvaluation'
import QuestionCollapsible from './elements/QuestionCollapsible'
import SEEvaluation from './elements/SEEvaluation'
import { TextSizeType } from './textSizes'

interface ElementEvaluationProps {
  currentInstance: ElementInstanceEvaluation
  activeInstance: number
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
  type: ActivityEvaluationType
  className?: string
}

function ElementEvaluation({
  currentInstance,
  activeInstance,
  textSize,
  chartType,
  showSolution,
  showExplanation,
  type,
  className,
}: ElementEvaluationProps) {
  return (
    <div className={twMerge('flex h-full flex-col', className)}>
      {currentInstance.__typename !== 'CaseStudyActivityEvaluationData' && (
        <div className="flex-none">
          <QuestionCollapsible
            activeInstance={activeInstance}
            content={currentInstance.content}
            proseSize={textSize.prose}
          />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {currentInstance.__typename === 'ChoicesActivityEvaluationData' && (
          <ChoicesEvaluation
            instanceEvaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
            showExplanation={showExplanation}
            type={type}
          />
        )}
        {currentInstance.__typename === 'NumericalActivityEvaluationData' && (
          <NREvaluation
            instanceEvaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
            showExplanation={showExplanation}
            type={type}
          />
        )}
        {currentInstance.__typename === 'FreeTextActivityEvaluationData' && (
          <FTEvaluation
            instanceEvaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
            showExplanation={showExplanation}
            type={type}
          />
        )}
        {currentInstance.__typename === 'SelectionActivityEvaluationData' && (
          <SEEvaluation
            instanceEvaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
            showExplanation={showExplanation}
          />
        )}
        {currentInstance.__typename === 'CaseStudyActivityEvaluationData' && (
          <CSEvaluation
            instanceEvaluation={currentInstance}
            activeInstance={activeInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
            showExplanation={showExplanation}
            type={type}
          />
        )}
        {currentInstance.__typename === 'FlashcardActivityEvaluationData' && (
          <FCEvaluation evaluation={currentInstance} />
        )}
        {currentInstance.__typename === 'ContentActivityEvaluationData' && (
          <CTEvaluation evaluation={currentInstance} />
        )}
      </div>
    </div>
  )
}

export default ElementEvaluation
