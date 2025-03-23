import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons'
import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import EvaluationExplanation from '@klicker-uzh/shared-components/src/evaluation/EvaluationExplanation'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  useArrowNavigation,
  UserNotification,
} from '@uzh-bf/design-system'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import useCaseStudyHistogramData from '../hooks/useCaseStudyHistogramData'
import { TextSizeType } from '../textSizes'
import { CSResultsEvaluationObject } from './CSEvaluation'
import CSEvaluationHistogramChart from './CSEvaluationHistogramChart'
import CSEvaluationHistogramSidebar from './CSEvaluationHistogramSidebar'

interface CSEvaluationHistogramProps {
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

function CSEvaluationHistogram({
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
}: CSEvaluationHistogramProps) {
  const t = useTranslations()

  // only either multiple cases or multiple items can be selected at a time
  const [selectedCases, setSelectedCases] = useState<string[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedCriterion, setSelectedCriterion] = useState<string>('')

  const onHistogramArrowUp = () => {
    const idx = criteria.findIndex(
      (criterion) => criterion.id === selectedCriterion
    )
    setSelectedCriterion(
      criteria[(idx - 1 + criteria.length) % criteria.length].id
    )
  }
  const onHistogramArrowDown = () => {
    const idx = criteria.findIndex(
      (criterion) => criterion.id === selectedCriterion
    )
    setSelectedCriterion(criteria[(idx + 1) % criteria.length].id)
  }

  // allow switching between criteria and corresponding histograms using up/down arrow keys
  useArrowNavigation({
    onArrowUp: onHistogramArrowUp,
    onArrowDown: onHistogramArrowDown,
  })

  // initialize axes based on criteria and selected cases based on passed props
  useEffect(() => {
    if (cases.length > 0 && selectedCases.length === 0) {
      setSelectedCases([cases[0].id])
    }

    if (items.length > 0 && selectedItems.length === 0) {
      setSelectedItems([String(items[0].id)])
    }

    if (criteria.length > 0 && selectedCriterion === '') {
      setSelectedCriterion(criteria[0].id)
    }
  }, [
    cases,
    items,
    criteria,
    selectedCases.length,
    selectedItems.length,
    selectedCriterion,
  ])

  const {
    histogramData,
    solutionData,
    histogramKeys,
    criterionMin,
    criterionMax,
    criterionName,
  } = useCaseStudyHistogramData({
    results,
    cases,
    items,
    selectedCases,
    selectedItems,
    selectedCriterion,
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
        <EvaluationExplanation
          explanation={explanation}
          showExplanation={showExplanation}
          textSize={textSize.text}
          textSizeLg={textSize.textLg}
        />
        <div className="min-h-0 flex-1 items-center justify-center px-1">
          {selectedCases.length > 0 &&
          selectedItems.length > 0 &&
          selectedCriterion ? (
            histogramData.length > 0 ? (
              <div className="flex h-full w-full flex-col items-center gap-2 py-4">
                {criteria.length > 1 && (
                  <Button onClick={onHistogramArrowUp}>
                    <Button.Icon withoutLabel icon={faArrowUp} />
                  </Button>
                )}
                <CSEvaluationHistogramChart
                  histogramData={histogramData}
                  solutionData={showSolution ? solutionData : undefined}
                  histogramKeys={histogramKeys}
                  criterionMin={criterionMin}
                  criterionMax={criterionMax}
                  criterionName={criterionName}
                  textSize={textSize}
                />
                {criteria.length > 1 && (
                  <Button onClick={onHistogramArrowDown}>
                    <Button.Icon withoutLabel icon={faArrowDown} />
                  </Button>
                )}
              </div>
            ) : (
              <UserNotification
                type="warning"
                message={t(
                  'manage.evaluation.caseStudySelectCasesItemsCriteria'
                )}
                className={{ root: 'text-base' }}
              />
            )
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
        <CSEvaluationHistogramSidebar
          cases={cases}
          items={items}
          selectedCases={selectedCases}
          setSelectedCases={setSelectedCases}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          criteria={criteria}
          selectedCriterion={selectedCriterion}
          setSelectedCriterion={setSelectedCriterion}
          textSize={textSize}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default CSEvaluationHistogram
