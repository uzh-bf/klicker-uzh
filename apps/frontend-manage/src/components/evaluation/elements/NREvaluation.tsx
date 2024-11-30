import { NumericalElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { useState } from 'react'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import NRSidebar from './NRSidebar'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { twMerge } from 'tailwind-merge'

interface NREvaluationProps {
  instanceEvaluation: NumericalElementInstanceEvaluation
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  type: ActivityEvaluationType
}

export interface ShowStatisticsType {
  mean?: boolean
  median?: boolean
  q1?: boolean
  q3?: boolean
  sd?: boolean
}

function NREvaluation({
  instanceEvaluation,
  textSize,
  chartType,
  showSolution,
  type,
}: NREvaluationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showStatistics, setShowStatistics] = useState<ShowStatisticsType>({
    mean: false,
    median: false,
    q1: false,
    q3: false,
    sd: false,
  })

  return (
    <ResizablePanelGroup
      autoSaveId="evaluation-nr"
      key={`panel-group-${instanceEvaluation.id}`}
      direction="horizontal"
    >
      <ResizablePanel defaultSize={80} minSize={50} className="px-4">
        <ElementChart
          chartType={chartType}
          instanceEvaluation={instanceEvaluation}
          showSolution={showSolution}
          showStatistics={showStatistics}
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
          <NRSidebar
            instance={instanceEvaluation}
            chartType={chartType}
            textSize={textSize}
            showSolution={showSolution}
            showStatistics={showStatistics}
            setShowStatistics={setShowStatistics}
            type={type}
          />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default NREvaluation
