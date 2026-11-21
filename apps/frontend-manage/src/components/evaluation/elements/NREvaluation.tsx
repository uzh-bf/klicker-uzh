import {
  LocaleType,
  NumericalActivityEvaluationData,
} from '@klicker-uzh/graphql/dist/ops'
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
} from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface NREvaluationProps {
  instanceEvaluation: NumericalActivityEvaluationData
  courseLanguage?: LocaleType | null
  isAssessmentEnabled: boolean
  pinCode?: string | null
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
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
  courseLanguage,
  isAssessmentEnabled,
  pinCode,
  textSize,
  chartType,
  showSolution,
  showExplanation,
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
      className="min-w-0 max-md:grid! max-md:grid-cols-1 max-md:content-start max-md:overflow-auto!"
    >
      <ResizablePanel
        defaultSize={80}
        minSize={50}
        className="min-w-0 px-4 max-md:min-h-80"
      >
        <ElementChart
          chartType={chartType}
          instanceEvaluation={instanceEvaluation}
          showSolution={showSolution}
          showExplanation={showExplanation}
          showStatistics={showStatistics}
          textSize={textSize}
        />
      </ResizablePanel>
      <ResizableHandle withHandle className="max-md:hidden" />
      <ResizablePanel
        defaultSize={20}
        minSize={10}
        collapsible
        collapsedSize={0}
        onCollapse={() => setIsCollapsed(true)}
        onExpand={() => setIsCollapsed(false)}
        className={twMerge(
          'min-w-0 gap-2 border-t px-4 py-2 max-md:min-h-48 md:border-l md:border-t-0',
          textSize.text
        )}
      >
        {!isCollapsed && (
          <NRSidebar
            instance={instanceEvaluation}
            courseLanguage={courseLanguage}
            isAssessmentEnabled={isAssessmentEnabled}
            pinCode={pinCode}
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
