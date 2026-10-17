import {
  FreeTextActivityEvaluationData,
  LocaleType,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import FTSidebar from './FTSidebar'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <>
      {showSolution ? (
        <ResizablePanelGroup
          autoSaveId="evaluation-ft"
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
