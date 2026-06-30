import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { ChoicesActivityEvaluationData, LocaleType } from '@lib/evaluationTypes'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import ChoicesSidebar from './ChoicesSidebar'

interface ChoicesEvaluationProps {
  instanceEvaluation: ChoicesActivityEvaluationData
  courseLanguage?: LocaleType | null
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
  isAssessmentEnabled: boolean
  pinCode?: string | null
  type: ActivityEvaluationType
}

function ChoicesEvaluation({
  instanceEvaluation,
  courseLanguage,
  textSize,
  chartType,
  showSolution,
  showExplanation,
  isAssessmentEnabled,
  pinCode,
  type,
}: ChoicesEvaluationProps) {
  return (
    <ResizablePanelGroup
      autoSaveId="evaluation-choices"
      key={`panel-group-${instanceEvaluation.id}`}
      direction="horizontal"
    >
      <ResizablePanel defaultSize={80} minSize={50} className="px-4">
        <ElementChart
          chartType={chartType}
          instanceEvaluation={instanceEvaluation}
          showSolution={showSolution}
          showExplanation={showExplanation}
          textSize={textSize}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize={20}
        minSize={10}
        collapsible
        collapsedSize={0}
        className={twMerge('gap-2 border-l px-4 py-2', textSize.text)}
      >
        <ChoicesSidebar
          instance={instanceEvaluation}
          courseLanguage={courseLanguage}
          isAssessmentEnabled={isAssessmentEnabled}
          pinCode={pinCode}
          textSize={textSize}
          showSolution={showSolution}
          type={type}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default ChoicesEvaluation
