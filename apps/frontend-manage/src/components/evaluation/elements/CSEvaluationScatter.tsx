import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
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
  results: CSResultsEvaluationObject
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  type: ActivityEvaluationType
}

function CSEvaluationScatter({
  evaluationId,
  results,
  cases,
  items,
  criteria,
  textSize,
  chartType,
  showSolution,
  type,
}: CSEvaluationScatterProps) {
  const t = useTranslations()

  const [selectedCases, setSelectedCases] = useState<string[]>([cases[0].id])
  const [xCriterion, setXCriterion] = useState<string | null>(null)
  const [yCriterion, setYCriterion] = useState<string | null>(null)
  const [aggregationType, setAggregationType] = useState<AggregationType>(
    AggregationType.MEAN
  )

  // initialize axes based on criteria
  useEffect(() => {
    if (criteria.length > 0) {
      setXCriterion(String(criteria[0].id))
    }
    if (criteria.length > 1) {
      setYCriterion(String(criteria[1].id))
    } else {
      setYCriterion(null)
    }
  }, [criteria])

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
    })

  return (
    <ResizablePanelGroup
      autoSaveId="evaluation-choices"
      key={`panel-group-${evaluationId}`}
      direction="horizontal"
    >
      <ResizablePanel defaultSize={70} minSize={50} className="px-4">
        {/* // TODO: extract to separate component?! */}
        {criteria.length === 1 && scatterData ? (
          <div>
            {/* // TODO */}
            1-DIM PLOT RECHARTS
          </div>
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
        ) : (
          <div className="flex h-full items-center justify-center">
            <UserNotification
              type="warning"
              message={t('manage.evaluation.caseStudySelectCasesCriteria')}
              className={{ root: 'py-auto text-lg' }}
            />
          </div>
        )}
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
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default CSEvaluationScatter
