import {
  FreeTextActivityEvaluationData,
  LocaleType,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import ElementChart from '../ElementChart'
import { TextSizeType } from '../textSizes'
import FreeTextRetryAnalytics from './FreeTextRetryAnalytics'
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
      {instanceEvaluation.retryAnalytics && (
        <FreeTextRetryAnalytics analytics={instanceEvaluation.retryAnalytics} />
      )}
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
            onCollapse={() => setIsCollapsed(true)}
            onExpand={() => setIsCollapsed(false)}
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
