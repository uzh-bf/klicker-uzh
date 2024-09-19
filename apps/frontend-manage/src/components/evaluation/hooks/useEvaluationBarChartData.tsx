import {
  ChoicesElementInstanceEvaluation,
  ElementInstanceEvaluation,
  ElementType,
  NumericalElementInstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import {
  QUESTION_GROUPS,
  SMALL_BAR_THRESHOLD,
} from '@klicker-uzh/shared-components/src/constants'
import { useMemo } from 'react'

interface UseEvaluationBarChartDataProps {
  instance: ElementInstanceEvaluation
}

function useEvaluationBarChartData({
  instance,
}: UseEvaluationBarChartDataProps) {
  const labeledData = useMemo(() => {
    if (QUESTION_GROUPS.CHOICES.includes(instance.type)) {
      const results = (instance as ChoicesElementInstanceEvaluation).results
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
    } else if (instance.type === ElementType.Numerical) {
      const results = (instance as NumericalElementInstanceEvaluation).results
      return results.responses.map((response, idx) => ({
        count: response.count,
        labelIn:
          response.count / results.totalAnswers > SMALL_BAR_THRESHOLD
            ? response.count
            : undefined,
        labelOut:
          response.count / results.totalAnswers <= SMALL_BAR_THRESHOLD
            ? response.count
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
