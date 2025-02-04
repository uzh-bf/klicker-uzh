import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
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
  results: CSResultsEvaluationObject
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  textSize: TextSizeType
  showSolution: boolean
  type: ActivityEvaluationType
}

function CSEvaluationHistogram({
  evaluationId,
  results,
  cases,
  items,
  criteria,
  textSize,
  showSolution,
  type,
}: CSEvaluationHistogramProps) {
  const t = useTranslations()

  // only either multiple cases or multiple items can be selected at a time
  const [selectedCases, setSelectedCases] = useState<string[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedCriterion, setSelectedCriterion] = useState<string>('')

  // TODO: add navigation with up / down arrow components to switch criterion

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
        className="flex items-center justify-center px-4"
      >
        {selectedCases.length > 0 &&
        selectedItems.length > 0 &&
        selectedCriterion ? (
          histogramData.length > 0 ? (
            <div className="flex h-full w-full flex-col items-center gap-2 py-4">
              <Button
                onClick={() => {
                  const idx = criteria.findIndex(
                    (criterion) => criterion.id === selectedCriterion
                  )
                  setSelectedCriterion(
                    criteria[(idx - 1 + criteria.length) % criteria.length].id
                  )
                }}
              >
                <FontAwesomeIcon icon={faArrowUp} />
              </Button>
              <CSEvaluationHistogramChart
                histogramData={histogramData}
                solutionData={showSolution ? solutionData : undefined}
                histogramKeys={histogramKeys}
                criterionMin={criterionMin}
                criterionMax={criterionMax}
              />
              <Button
                onClick={() => {
                  const idx = criteria.findIndex(
                    (criterion) => criterion.id === selectedCriterion
                  )
                  setSelectedCriterion(criteria[(idx + 1) % criteria.length].id)
                }}
              >
                <FontAwesomeIcon icon={faArrowDown} />
              </Button>
            </div>
          ) : (
            <UserNotification
              type="warning"
              message={t('manage.evaluation.caseStudySelectCasesItemsCriteria')}
              className={{ root: 'text-base' }}
            />
          )
        ) : (
          <Loader />
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
