import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterion,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { round, sumBy } from 'remeda'
import { CSResultsEvaluationObject } from '../elements/CSEvaluation'

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
        (criterionMax - binValue < (2 * binWidth) / 3
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
    30,
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

function useCaseStudyHistogramData({
  results,
  cases,
  items,
  selectedCases,
  selectedItems,
  selectedCriterion,
}: {
  results: CSResultsEvaluationObject
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  selectedCases: string[]
  selectedItems: string[]
  selectedCriterion: string
}): {
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
} {
  return useMemo(() => {
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
        30,
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
      if (
        resultObjects.some((result) => result === null) ||
        resultObjects.length === 0
      ) {
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
      if (
        resultObjects.some((result) => result === null) ||
        resultObjects.length === 0
      ) {
        return missingData
      }

      return combineResultsIntoHistogramData({
        results: resultObjects as {
          dataKey: string
          result: CaseStudyElementResultCriterion
        }[],
      })
    }
  }, [results, cases, items, selectedCases, selectedItems, selectedCriterion])
}

export default useCaseStudyHistogramData
