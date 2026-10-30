import type {
  FreeTextActivityEvaluationData,
  LocaleType,
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
import FTSidebar from './FTSidebar'

interface FTEvaluationProps {
  instanceEvaluation: FreeTextActivityEvaluationData
  courseLanguage?: LocaleType | null
  isAssessmentEnabled: boolean
  pinCode?: string | null
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
  type: ActivityEvaluationType
}

function FTEvaluation({
  instanceEvaluation,
  courseLanguage,
  isAssessmentEnabled,
  pinCode,
  textSize,
  chartType,
  showSolution,
  showExplanation,
  type,
}: FTEvaluationProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'evaluation-ft',
    panelIds: ['evaluation-ft-chart', 'evaluation-ft-sidebar'],
  })
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <>
      {showSolution ? (
        <ResizablePanelGroup
          id="evaluation-ft"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          key={`panel-group-${instanceEvaluation.id}`}
          orientation="horizontal"
        >
          <ResizablePanel
            id="evaluation-ft-chart"
            defaultSize="80%"
            minSize="50%"
            className="px-4"
          >
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
            id="evaluation-ft-sidebar"
            defaultSize="20%"
            minSize="10%"
            collapsible
            collapsedSize="0%"
            onResize={({ asPercentage }) => setIsCollapsed(asPercentage === 0)}
            className={twMerge('gap-2 border-l px-4 py-2', textSize.text)}
          >
            {instanceEvaluation.results.solutions &&
              showSolution &&
              !isCollapsed && (
                <FTSidebar
                  instance={instanceEvaluation}
                  courseLanguage={courseLanguage}
                  isAssessmentEnabled={isAssessmentEnabled}
                  pinCode={pinCode}
                  textSize={textSize}
                  showSolution={showSolution}
                  type={type}
                />
              )}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <ElementChart
          chartType={chartType}
          instanceEvaluation={instanceEvaluation}
          showSolution={showSolution}
          showExplanation={showExplanation}
          textSize={textSize}
          className="px-4"
        />
      )}
    </>
  )
}

export default FTEvaluation
