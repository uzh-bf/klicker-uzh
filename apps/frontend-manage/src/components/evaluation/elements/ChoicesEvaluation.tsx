import { ChoicesElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import ChoicesSidebar from './ChoicesSidebar'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { twMerge } from 'tailwind-merge'

interface ChoicesEvaluationProps {
  instanceEvaluation: ChoicesElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  type: ActivityEvaluationType
}

function ChoicesEvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
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
          textSize={textSize}
          showSolution={showSolution}
          type={type}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default ChoicesEvaluation
