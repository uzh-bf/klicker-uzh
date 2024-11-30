import { FreeElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import FTSidebar from './FTSidebar'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <>
      {showSolution ? (
        <ResizablePanelGroup
          autoSaveId="evaluation-ft"
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
            {instanceEvaluation.results.solutions &&
              showSolution &&
              !isCollapsed && (
                <FTSidebar
                  instance={instanceEvaluation}
                  textSize={textSize}
                  showSolution={showSolution}
                  type={type}
                />
              )}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="order-2 flex-1 px-4 md:order-1">
          <ElementChart
            chartType={chartType}
            instanceEvaluation={instanceEvaluation}
            showSolution={showSolution}
            textSize={textSize}
          />
        </div>
      )}
    </>
  )
}

export default FTEvaluation
