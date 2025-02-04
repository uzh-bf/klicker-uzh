import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterion,
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
import { useEffect, useMemo, useState } from 'react'
import { round, sumBy } from 'remeda'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import { CSResultsEvaluationObject } from './CSEvaluation'
import CSEvaluationHistogramChart from './CSEvaluationHistogramChart'
import CSEvaluationHistogramSidebar from './CSEvaluationHistogramSidebar'

// TODO: extract these helper functions to the same auxilary file as the histogram data computation hook
function solutionFromCriterionResult({
  result,
}: {
  result: CaseStudyElementResultCriterion
}) {
  return typeof result.solutionMin !== 'undefined' &&
    result.solutionMin !== null &&
    typeof result.solutionMax !== 'undefined' &&
    result.solutionMax !== null
    ? {
        min: result.solutionMin,
        max: result.solutionMax,
      }
    : undefined
}

function countResponsesInBin({
  result,
  binWidth,
  binValue,
  criterionMax,
}: {
  result: CaseStudyElementResultCriterion
  binWidth: number
  binValue: number
  criterionMax: number
}) {
  return sumBy(
    result.responses.filter((response) => {
      return (
        response.value >= binValue - binWidth / 2 &&
        (binValue + binWidth / 2 === criterionMax
          ? response.value <= criterionMax
          : response.value < binValue + binWidth / 2)
      )
    }),
    (response) => response.count
  )
}

function combineResultsIntoHistogramData({
  results,
}: {
  results: {
    dataKey: string
    result: CaseStudyElementResultCriterion
  }[]
}) {
  // extract criterion min, max and bin width from first result
  const firstResult = results[0]
  const criterionMin = firstResult.result.min
  const criterionMax = firstResult.result.max
  const binCount = Math.min(
    50,
    (criterionMax - criterionMin) / firstResult.result.step
  )

  // initialize the histogram data structure with corresponding empty bins
  const histogramData: {
    value: number
    label: string
    [dataIx: string]: number | string
  }[] = Array.from({ length: binCount }, (_, i) => ({
    value: round(
      criterionMin +
        (criterionMax - criterionMin) * (i / binCount) +
        (criterionMax - criterionMin) / (2 * binCount),
      2
    ),
    label: '',
  }))
  const binWidth =
    histogramData.length > 1
      ? histogramData[1]!.value - histogramData[0]!.value
      : 1

  // iterate over all bins in the histogramData and count the number of responses in
  // each bin for the corresponding results object (store in associated dataKey)
  const completeHistogramData = histogramData.map((bin) => {
    return {
      value: round(bin.value, 2),
      label: `${round(bin.value - binWidth / 2, 1)} - ${round(
        bin.value + binWidth / 2,
        1
      )}`,
      ...results.reduce(
        (acc, { dataKey, result }) => {
          acc[dataKey] = countResponsesInBin({
            result,
            binWidth,
            binValue: bin.value,
            criterionMax,
          })
          return acc
        },
        {} as { [key: string]: number }
      ),
    }
  })

  const solutionData = results.reduce(
    (acc, { dataKey, result }) => {
      acc[dataKey] = solutionFromCriterionResult({ result })
      return acc
    },
    {} as { [key: string]: { min: number; max: number } | undefined }
  )

  return {
    histogramData: completeHistogramData,
    solutionData,
    histogramKeys: results.map((result) => result.dataKey),
    criterionMin,
    criterionMax,
  }
}

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

  // TODO: extract to custom hook
  const {
    histogramData,
    solutionData,
    histogramKeys,
    criterionMin,
    criterionMax,
  }: {
    histogramData: {
      value: number
      label: string
      [dataIx: string]: string | number // only number will be provided
    }[]
    solutionData?: {
      [dataIx: string]: { min: number; max: number } | undefined
    }
    histogramKeys: string[]
    criterionMin: number
    criterionMax: number
  } = useMemo(() => {
    const missingData = {
      histogramData: [], // contains all data points with the keys specified in histogramKeys
      solutionData: {}, // contains potential solution intervals, if they are defined with histogramKeys as keys
      histogramKeys: [], // keys for data access, containing index for color choice ("count" for single, "caseName-0" / "itemName-0", etc. for multiple cases / items)
      criterionMin: 0,
      criterionMax: 0,
    }

    if (
      selectedCases.length === 0 ||
      selectedItems.length === 0 ||
      selectedCriterion === ''
    ) {
      return missingData
    }

    if (selectedCases.length === 1 && selectedItems.length === 1) {
      // scenario 1, single data point
      const resultObject =
        results[selectedCases[0]]?.[selectedItems[0]]?.[selectedCriterion]

      if (!resultObject) {
        return missingData
      }

      const criterionMin = resultObject.min
      const criterionMax = resultObject.max
      const binCount = Math.min(
        50,
        (criterionMax - criterionMin) / resultObject.step
      )

      // sort responses into bins and count number of responses in each bin
      let dataArray = Array.from({ length: binCount }, (_, i) => ({
        value:
          criterionMin +
          (criterionMax - criterionMin) * (i / binCount) +
          (criterionMax - criterionMin) / (2 * binCount),
        count: 0,
        label: '',
      }))
      dataArray = dataArray.map((bin) => {
        const binWidth =
          dataArray.length > 1 ? dataArray[1]!.value - dataArray[0]!.value : 1

        return {
          value: round(bin.value, 2),
          count: countResponsesInBin({
            result: resultObject,
            binWidth,
            binValue: bin.value,
            criterionMax,
          }),
          label: `${round(bin.value - binWidth / 2, 1)} - ${round(
            bin.value + binWidth / 2,
            1
          )}`,
        }
      })

      // compute solution data as an object of dataKey and solution range
      const solutionData = {
        count: solutionFromCriterionResult({ result: resultObject }),
      }

      return {
        histogramData: dataArray,
        solutionData,
        histogramKeys: ['count'],
        criterionMin,
        criterionMax,
      }
    } else if (selectedCases.length > 1) {
      const resultObjects = selectedCases.map((caseId) => {
        const caseObject = cases.find((c) => c.id === caseId)
        const caseIx = cases.findIndex((c) => c.id === caseId)
        const resultObject =
          results[caseId]?.[selectedItems[0]]?.[selectedCriterion]

        if (!caseObject || !resultObject) {
          return null
        }

        return {
          dataKey: `${caseObject.name.replace(/-/g, '')}-${caseIx}`,
          result: resultObject,
        }
      })

      // if any of the results is missing, return missing data
      if (resultObjects.some((result) => result === null)) {
        return missingData
      }

      return combineResultsIntoHistogramData({
        results: resultObjects as {
          dataKey: string
          result: CaseStudyElementResultCriterion
        }[],
      })
    } else {
      const resultObjects = selectedItems.map((itemId) => {
        const item = items.find((i) => i.id === parseInt(itemId))
        const itemIx = items.findIndex((i) => i.id === parseInt(itemId))
        const resultObject =
          results[selectedCases[0]]?.[itemId]?.[selectedCriterion]

        if (!item || !resultObject) {
          return null
        }

        return {
          dataKey: `${item.name.replace(/-/g, '')}-${itemIx}`,
          result: resultObject,
        }
      })

      // if any of the results is missing, return missing data
      if (resultObjects.some((result) => result === null)) {
        return missingData
      }

      return combineResultsIntoHistogramData({
        results: resultObjects as {
          dataKey: string
          result: CaseStudyElementResultCriterion
        }[],
      })
    }
  }, [selectedCases, selectedItems, selectedCriterion, results])

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
