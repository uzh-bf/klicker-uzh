import {
  ElementType,
  type NumericalSolutionRange,
} from '@klicker-uzh/graphql/dist/ops'
import { maxBy, minBy, round, sumBy } from 'lodash'
import { useMemo } from 'react'

interface UseEvaluationHistogramDataProps {
  type: ElementType
  responses: { value: number; count: number }[]
  solutionRanges?: NumericalSolutionRange[] | null
  exactSolutions?: number[] | null
  minValue?: number | null
  maxValue?: number | null
  binCount: number
}

function useEvaluationHistogramData({
  type,
  responses,
  solutionRanges,
  exactSolutions,
  minValue,
  maxValue,
  binCount,
}: UseEvaluationHistogramDataProps) {
  const histogramData = useMemo(() => {
    if (type !== ElementType.Numerical) {
      return null
    }

    // use the minima defined for the solution ranges and exact solutions to compute the bounds for the histogram
    const solutionRangesMin =
      minBy(solutionRanges, 'min')?.min ?? Number.MAX_VALUE
    const solutionRangesMax =
      maxBy(solutionRanges, 'max')?.max ?? Number.MIN_VALUE
    const exactSolutionsMin = minBy(exactSolutions) ?? Number.MAX_VALUE
    const exactSolutionsMax = maxBy(exactSolutions) ?? Number.MIN_VALUE
    const solutionsMin = Math.min(solutionRangesMin, exactSolutionsMin)
    const solutionsMax = Math.max(solutionRangesMax, exactSolutionsMax)

    // compute the lower and upper bounds of the histogram
    const min: number =
      minValue !== null && typeof minValue === 'number'
        ? minValue
        : Math.min(minBy(responses, 'value')?.value ?? 0, solutionsMin) - 10
    const max: number =
      maxValue !== null && typeof maxValue === 'number'
        ? maxValue
        : Math.max(maxBy(responses, 'value')?.value ?? 0, solutionsMax) + 10

    // organize the data into histogram bins based on the computed min and max values
    let dataArray = Array.from({ length: binCount }, (_, i) => ({
      value: min + (max - min) * (i / binCount) + (max - min) / (2 * binCount),
    }))
    dataArray = dataArray.map((bin) => {
      const binWidth =
        dataArray.length > 1 ? dataArray[1]!.value - dataArray[0]!.value : 1
      const count = sumBy(
        responses.filter((response) => {
          return (
            response.value >= bin.value - binWidth / 2 &&
            (bin.value + binWidth / 2 === max
              ? response.value <= max
              : response.value < bin.value + binWidth / 2)
          )
        }),
        'count'
      )
      return {
        value: round(bin.value, 2),
        count,
        label: `${round(bin.value - binWidth / 2, 1)} - ${round(
          bin.value + binWidth / 2,
          1
        )}`,
      }
    })

    return { data: dataArray, domain: { min: min, max: max } }
  }, [
    binCount,
    exactSolutions,
    maxValue,
    minValue,
    responses,
    solutionRanges,
    type,
  ])

  return histogramData
}

export default useEvaluationHistogramData
