import {
  ElementType,
  NumericalElementInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { maxBy, minBy, round, sumBy } from 'lodash'
import { useMemo } from 'react'

interface UseEvaluationHistogramDataProps {
  instance: NumericalElementInstanceEvaluation
  binCount: number
}

function useEvaluationHistogramData({
  instance,
  binCount,
}: UseEvaluationHistogramDataProps) {
  const histogramData = useMemo(() => {
    if (instance.type !== ElementType.Numerical) {
      return null
    }

    const responses = instance.results.responseValues.map((response) => ({
      value: response.value,
      count: response.count,
    }))

    const min: number =
      instance.results.minValue && typeof instance.results.minValue === 'number'
        ? instance.results.minValue
        : (minBy(responses, 'value')?.value ?? 0) - 10
    const max: number =
      instance.results.maxValue && typeof instance.results.maxValue === 'number'
        ? instance.results.maxValue
        : (maxBy(responses, 'value')?.value ?? 0) + 10

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
  }, [instance, binCount])

  return histogramData
}

export default useEvaluationHistogramData
