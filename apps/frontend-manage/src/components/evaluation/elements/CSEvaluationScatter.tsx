import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import EvaluationExplanation from '@klicker-uzh/shared-components/src/evaluation/EvaluationExplanation'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import useCaseStudyScatterData from '../hooks/useCaseStudyScatterData'
import { TextSizeType } from '../textSizes'
import { CSResultsEvaluationObject } from './CSEvaluation'
import CSEvaluationScatterSidebar from './CSEvaluationScatterSidebar'
import CSOneDimScatterPlot from './CSOneDimScatterPlot'
import CSTwoDimScatterPlot from './CSTwoDimScatterPlot'

export enum AggregationType {
  MEAN = 'mean',
  MEDIAN = 'median',
}

export type CaseStudyScatterPlotData = {
  [caseId: string]: {
    itemLabel: string
    caseName: string
    xCriterionName: string
    yCriterionName: string
    x: number
    y: number | undefined
  }[]
}

interface CSEvaluationScatterProps {
  evaluationId: number
  explanation?: string | null
  results: CSResultsEvaluationObject
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  textSize: TextSizeType
  showSolution: boolean
  showExplanation: boolean
  type: ActivityEvaluationType
}

function CSEvaluationScatter({
  evaluationId,
  explanation,
  results,
  cases,
  items,
  criteria,
  textSize,
  showSolution,
  showExplanation,
  type,
}: CSEvaluationScatterProps) {
  const t = useTranslations()

  const [initialLoading, setInitialLoading] = useState(true)
  const [selectedCases, setSelectedCases] = useState<string[]>([])
  const [xCriterion, setXCriterion] = useState<string | null>(null)
  const [yCriterion, setYCriterion] = useState<string | null>(null)
  const [aggregationType, setAggregationType] = useState<AggregationType>(
    AggregationType.MEAN
  )

  // initialize axes based on criteria and selected cases based on passed props
  useEffect(() => {
    if (cases.length > 0 && selectedCases.length === 0) {
      setSelectedCases([cases[0].id])
    }

    if (criteria.length > 0) {
      setXCriterion(String(criteria[0].id))
    }
    if (criteria.length > 1) {
      setYCriterion(String(criteria[1].id))
    } else {
      setYCriterion(null)
    }
  }, [cases, criteria, selectedCases.length])

  // compute data for scatter plot
  const { scatterData, xLower, xUpper, yLower, yUpper } =
    useCaseStudyScatterData({
      results,
      cases,
      items,
      criteria,
      selectedCases,
      xCriterion,
      yCriterion,
      aggregationType,
      setInitialLoading,
    })

  return (
    <ResizablePanelGroup
      autoSaveId="evaluation-case-study"
      key={`panel-group-${evaluationId}`}
      direction="horizontal"
    >
      <ResizablePanel
        defaultSize={70}
        minSize={50}
        className="flex h-full w-full flex-col px-3"
      >
        {showExplanation && explanation && (
          <EvaluationExplanation
            explanation={explanation}
            showExplanation={showExplanation}
            textSize={textSize.text}
            textSizeLg={textSize.textLg}
          />
        )}
        <div className="min-h-0 flex-1 items-center justify-center px-1">
          {criteria.length === 1 && scatterData && xCriterion ? (
            <CSOneDimScatterPlot
              scatterData={scatterData}
              selectedCases={selectedCases}
              cases={cases}
              criteria={criteria}
              textSize={textSize}
              xCriterion={xCriterion}
              xLower={xLower}
              xUpper={xUpper}
            />
          ) : criteria.length > 1 && xCriterion && yCriterion && scatterData ? (
            <CSTwoDimScatterPlot
              cases={cases}
              selectedCases={selectedCases}
              criteria={criteria}
              scatterData={scatterData}
              xCriterion={xCriterion}
              yCriterion={yCriterion}
              xLower={xLower}
              xUpper={xUpper}
              yLower={yLower}
              yUpper={yUpper}
              textSize={textSize}
            />
          ) : !initialLoading && selectedCases.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <UserNotification
                type="warning"
                message={t('manage.evaluation.caseStudySelectCasesCriteria')}
                className={{ root: 'py-auto text-lg' }}
              />
            </div>
          ) : (
            <Loader />
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle className="w-0.5" />
      <ResizablePanel
        defaultSize={30}
        minSize={20}
        collapsible
        collapsedSize={0}
        className={twMerge('gap-2 border-l', textSize.text)}
      >
        <CSEvaluationScatterSidebar
          cases={cases}
          selectedCases={selectedCases}
          setSelectedCases={setSelectedCases}
          criteria={criteria}
          xCriterion={xCriterion}
          setXCriterion={setXCriterion}
          yCriterion={yCriterion}
          setYCriterion={setYCriterion}
          aggregationType={aggregationType}
          setAggregationType={setAggregationType}
          textSize={textSize}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default CSEvaluationScatter
