import { ElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { SMALL_BAR_THRESHOLD } from '@klicker-uzh/shared-components/src/constants'
import { useMemo } from 'react'

interface UseEvaluationBarChartDataProps {
  instance: ElementInstanceEvaluation
}

function useEvaluationBarChartData({
  instance,
}: UseEvaluationBarChartDataProps) {
  const labeledData = useMemo(() => {
    if (instance.__typename === 'ChoicesElementInstanceEvaluation') {
      const results = instance.results
      return results.choices.map((choice, idx) => ({
        count: choice.count,
        labelIn:
          choice.count / results.totalAnswers > SMALL_BAR_THRESHOLD
            ? choice.count
            : undefined,
        labelOut:
          choice.count / results.totalAnswers <= SMALL_BAR_THRESHOLD
            ? choice.count
            : undefined,
        xLabel: String.fromCharCode(Number(idx) + 65),
      }))
    } else {
      return []
    }
  }, [instance])

  return labeledData
}

export default useEvaluationBarChartData
