import type {
  LocaleType,
  NumericalActivityEvaluationData,
} from '@klicker-uzh/graphql/dist/ops'
import type { ChartType } from '@klicker-uzh/shared-components/src/constants'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
} from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import type { TextSizeType } from '../textSizes'
import NRSidebar from './NRSidebar'

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
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'evaluation-nr',
    panelIds: ['evaluation-nr-chart', 'evaluation-nr-sidebar'],
  })
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
      id="evaluation-nr"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      key={`panel-group-${instanceEvaluation.id}`}
      orientation="horizontal"
    >
      <ResizablePanel
        id="evaluation-nr-chart"
        defaultSize="80%"
        minSize="50%"
        className="px-4"
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
      <ResizableHandle withHandle />
      <ResizablePanel
        id="evaluation-nr-sidebar"
        defaultSize="20%"
        minSize="10%"
        collapsible
        collapsedSize="0%"
        onResize={({ asPercentage }) => setIsCollapsed(asPercentage === 0)}
        className={twMerge('gap-2 border-l px-4 py-2', textSize.text)}
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
