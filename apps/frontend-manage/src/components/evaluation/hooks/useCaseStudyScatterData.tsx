import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { CSResultsEvaluationObject } from '../elements/CSEvaluation'
import {
  AggregationType,
  CaseStudyScatterPlotData,
} from '../elements/CSEvaluationScatter'

function useCaseStudyScatterData({
  results,
  cases,
  items,
  criteria,
  selectedCases,
  xCriterion,
  yCriterion,
  aggregationType,
  setInitialLoading,
}: {
  results: CSResultsEvaluationObject
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  selectedCases: string[]
  xCriterion: string | null
  yCriterion: string | null
  aggregationType: AggregationType
  setInitialLoading: Dispatch<SetStateAction<boolean>>
}) {
  return useMemo(() => {
    // if no cases are selected, return early
    if (
      selectedCases.length === 0 ||
      xCriterion === null ||
      (criteria.length > 1 && yCriterion === null)
    ) {
      return {
        scatterData: null,
        xLower: 0,
        xUpper: 0,
        yLower: 0,
        yUpper: 0,
      }
    }

    const data = selectedCases.reduce<CaseStudyScatterPlotData>(
      (caseAcc, caseId: string) => {
        const caseObject = cases.find((c) => c.id === caseId)

        caseAcc[caseId] = items.flatMap((item) => {
          const xCriterionObject = results[caseId]?.[item.id]?.[xCriterion]
          const yCriterionObject = yCriterion
            ? results[caseId]?.[item.id]?.[yCriterion]
            : undefined

          const xValue = xCriterionObject?.statistics?.[aggregationType]
          const yValue = yCriterionObject?.statistics?.[aggregationType]

          if (
            typeof xValue === 'undefined' ||
            (yCriterion && typeof yValue === 'undefined')
          ) {
            return []
          }

          return {
            itemLabel: item.name,
            caseName: caseObject?.name ?? '',
            xCriterionName: xCriterionObject.name,
            yCriterionName: yCriterionObject?.name ?? '',
            x: xValue,
            y: yValue,
            sigmaX:
              aggregationType === 'mean'
                ? xCriterionObject?.statistics?.sd
                : undefined, // standard deviation in x direction (only set around mean)
            sigmaY:
              aggregationType === 'mean'
                ? yCriterionObject?.statistics?.sd
                : undefined, // standard deviation in y direction (only set around mean)
          }
        })

        return caseAcc
      },
      {}
    )

    setInitialLoading(false)
    return {
      scatterData: data,
      xLower: results[selectedCases[0]]?.[items[0].id]?.[xCriterion]?.min,
      xUpper: results[selectedCases[0]]?.[items[0].id]?.[xCriterion]?.max,
      yLower: yCriterion
        ? results[selectedCases[0]]?.[items[0].id]?.[yCriterion]?.min
        : 0,
      yUpper: yCriterion
        ? results[selectedCases[0]]?.[items[0].id]?.[yCriterion]?.max
        : 0,
    }
  }, [
    results,
    items,
    cases,
    criteria.length,
    selectedCases,
    xCriterion,
    yCriterion,
    aggregationType,
    setInitialLoading,
  ])
}

export default useCaseStudyScatterData
