import { NumericalElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import NumericalSidebar from './NumericalSidebar'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { useState } from 'react'

interface NREvaluationProps {
  instanceEvaluation: NumericalElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
}

function NREvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
}: NREvaluationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <ResizablePanelGroup
      autoSaveId={`evaluation-${instanceEvaluation.id}`}
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
        onCollapse={() => setIsCollapsed(true)}
        onExpand={() => setIsCollapsed(false)}
        className={twMerge('gap-2 border-l px-4 py-2', textSize.text)}
      >
        {!isCollapsed && (
          <NumericalSidebar
            instance={instanceEvaluation}
            textSize={textSize}
            showSolution={showSolution}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default NREvaluation
