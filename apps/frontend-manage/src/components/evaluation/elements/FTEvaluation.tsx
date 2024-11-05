import { FreeElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import FTSidebar from './FTSidebar'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'

interface FTEvaluationProps {
  instanceEvaluation: FreeElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
}

function FTEvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
}: FTEvaluationProps) {
  return (
    <ResizablePanelGroup direction="horizontal">
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
        {instanceEvaluation.results.solutions && showSolution && (
          <FTSidebar
            instance={instanceEvaluation}
            textSize={textSize}
            showSolution={showSolution}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default FTEvaluation
